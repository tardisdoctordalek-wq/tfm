//! End-to-end checks against documents taken from a real save.
//!
//! The fixtures are verbatim excerpts of a `schema_dump.txt` produced by the
//! mod in-game: `champion_tiers.json` is the tier field off a team record,
//! and `league_competition.json` is a competition document carrying the
//! `statistics.<athlete>.champion_detail` rows the win rates come from.
//! Synthetic tests cover the edge cases; these cover "does it work on the
//! shapes the game actually stores".

use winrate_tiers::json::Value;
use winrate_tiers::schema::{self, SinkShape, Unrated};
use winrate_tiers::stats;
use winrate_tiers::tiers::{self, ChampionRecord, Mode, Model, Shares, Thresholds};

fn fixture(name: &str) -> Value {
    let path = format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
    let text = std::fs::read_to_string(&path).expect("fixture readable");
    Value::parse(&text).expect("fixture parses")
}

fn competition_records() -> Vec<ChampionRecord> {
    let totals = stats::read_competition(&fixture("league_competition.json"));
    totals
        .into_iter()
        .enumerate()
        .map(|(index, (key, totals))| ChampionRecord {
            champion_id: index,
            key,
            matches: totals.matches,
            wins: totals.wins,
        })
        .collect()
}

#[test]
fn reads_champion_stats_out_of_a_real_competition_document() {
    let records = competition_records();
    assert!(records.len() > 30, "expected a full roster, got {}", records.len());

    let games: f64 = records.iter().map(|record| record.matches).sum();
    let wins: f64 = records.iter().map(|record| record.wins).sum();
    assert!(games > 500.0, "expected a season of games, got {games}");

    // Every game has exactly one winning side, so the aggregate win rate
    // across all champions has to sit near 50%. A parsing slip that doubled
    // or dropped rows would show up here.
    let overall = wins / games;
    assert!((0.45..=0.55).contains(&overall), "aggregate win rate {overall} is off");

    for record in &records {
        assert!(record.wins <= record.matches, "{} has more wins than games", record.key);
        assert!(record.matches > 0.0);
    }
}

#[test]
fn the_live_tier_field_is_located_and_classified() {
    let team = Value::parse(&format!(
        r#"{{"champion_personal_tactics":{{}},"champion_tiers":{},"name":"T1"}}"#,
        std::fs::read_to_string(format!(
            "{}/tests/fixtures/champion_tiers.json",
            env!("CARGO_MANIFEST_DIR")
        ))
        .unwrap()
    ))
    .unwrap();

    let sink = schema::find_tier_sink(&team, None).expect("tier field found");
    assert_eq!(sink.path, schema::KNOWN_TIER_PATH);
    assert_eq!(sink.shape, SinkShape::MapOfLabels);
}

#[test]
fn the_vanilla_tier_list_is_the_shape_the_encoder_produces() {
    let vanilla = fixture("champion_tiers.json");
    let entries = vanilla.as_object().expect("object");
    assert_eq!(entries.len(), 57);
    // The live schema carries a tier for every champion and has no "no tier"
    // value - which is why Unrated::Keep is the default.
    for (champion, tier) in entries {
        let label = tier.as_str().unwrap_or_default();
        assert!(matches!(label, "S" | "A" | "B" | "C" | "D"), "{champion} = {label:?}");
    }
}

#[test]
fn full_pipeline_over_real_data_produces_the_configured_distribution() {
    let records = competition_records();
    let shares = Shares { s: 0.10, a: 0.20, b: 0.30, c: 0.25 };
    let assignments = tiers::classify(
        &records,
        &Model::default(),
        Mode::Percentile,
        &shares,
        &Thresholds::default(),
    );

    let rated = assignments.iter().filter(|entry| entry.tier != tiers::Tier::None).count();
    let count = |tier: tiers::Tier| assignments.iter().filter(|e| e.tier == tier).count();

    // Every rated champion lands in exactly one tier, in the configured
    // proportions (+/- rounding and tie-grouping).
    assert_eq!(
        count(tiers::Tier::S)
            + count(tiers::Tier::A)
            + count(tiers::Tier::B)
            + count(tiers::Tier::C)
            + count(tiers::Tier::D),
        rated
    );
    let b_share = count(tiers::Tier::B) as f64 / rated as f64;
    assert!((0.22..=0.38).contains(&b_share), "B share {b_share} off target 0.30");

    // The point of the rewrite: B must not swallow the roster the way fixed
    // cut-offs do on this same data.
    let threshold_run = tiers::classify(
        &records,
        &Model::default(),
        Mode::Threshold,
        &shares,
        &Thresholds { s: 0.55, a: 0.52, b: 0.48, c: 0.45 },
    );
    let threshold_b = threshold_run.iter().filter(|e| e.tier == tiers::Tier::B).count();
    assert!(
        threshold_b > count(tiers::Tier::B),
        "old cut-offs put {threshold_b} in B, new split puts {}",
        count(tiers::Tier::B)
    );
}

#[test]
fn the_written_document_stays_a_complete_valid_tier_list() {
    let vanilla = fixture("champion_tiers.json");
    let records = competition_records();
    let assignments = tiers::classify(
        &records,
        &Model::default(),
        Mode::Percentile,
        &Shares::default(),
        &Thresholds::default(),
    );

    let payload =
        schema::encode_assignment(SinkShape::MapOfLabels, &assignments, Some(&vanilla), Unrated::Keep);
    let written = Value::parse(&payload).expect("payload is valid JSON");
    let entries = written.as_object().expect("payload is an object");

    // Nothing the save had may go missing, and every value stays a real tier.
    for champion in vanilla.as_object().unwrap().keys() {
        assert!(entries.contains_key(champion), "{champion} dropped from the tier list");
    }
    for (champion, tier) in entries {
        let label = tier.as_str().unwrap_or_default();
        assert!(matches!(label, "S" | "A" | "B" | "C" | "D"), "{champion} = {label:?}");
    }

    // Champions the stats did rate actually changed to their computed tier.
    let rated: Vec<_> = assignments.iter().filter(|e| e.tier != tiers::Tier::None).collect();
    assert!(!rated.is_empty());
    for entry in rated {
        assert_eq!(
            entries.get(&entry.key).and_then(Value::as_str),
            Some(entry.tier.label()),
            "{} was not written as {}",
            entry.key,
            entry.tier
        );
    }
}
