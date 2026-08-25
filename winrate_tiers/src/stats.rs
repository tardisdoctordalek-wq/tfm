//! Aggregating champion win/loss records out of the save.
//!
//! The layout is now known from a real `schema_dump.txt`, so this reads the
//! actual documents rather than guessing:
//!
//! * **Competition** — `LeagueCompetition` and `TournamentCompetition` both
//!   carry `statistics`, an object keyed by athlete id. Each athlete has
//!   `champion_detail`, an object keyed by champion holding `matches` and
//!   `wins`. Summing over every athlete gives the champion's pick and win
//!   count. Records also carry `finalized`, so a finished competition is
//!   read once and cached.
//!
//! * **Solo rank** — `SoloRankMatch` is one document per match:
//!   `blue_team[]`/`red_team[]` rows each name a `champion`, and
//!   `blue_team_win` says who won. These documents are large and there are
//!   thousands of them, so only the handful of scalar fields that matter are
//!   read by path, and each match id is counted once and remembered.

use std::collections::{BTreeMap, BTreeSet};

use mod_api_stable::{RecordKindV1, StableServerCtx};

use crate::json::Value;
use crate::tiers::ChampionRecord;

/// Competition record kinds carrying `statistics.<athlete>.champion_detail`.
const COMPETITION_KINDS: [RecordKindV1; 2] =
    [RecordKindV1::LeagueCompetition, RecordKindV1::TournamentCompetition];

/// Upper bound on players scanned per side of a solo-rank match. Team size
/// varies with the game rule (5v5, 3v3, 2v2); the scan stops at the first
/// missing slot and this only guards against a runaway loop.
const MAX_TEAM_SLOTS: usize = 10;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Totals {
    pub matches: f64,
    pub wins: f64,
}

impl Totals {
    fn add(&mut self, matches: f64, wins: f64) {
        self.matches += matches;
        self.wins += wins;
    }
}

/// Running aggregate. Kept across recomputes so the expensive first pass is
/// not repeated: finished competitions and played solo matches never change.
#[derive(Default)]
pub struct Collector {
    /// Per-competition contribution, keyed by (record kind code, record id).
    /// Cached only once the competition reports `finalized`.
    finished: BTreeMap<(u32, usize), BTreeMap<String, Totals>>,
    solo: BTreeMap<String, Totals>,
    counted_solo: BTreeSet<usize>,
}

/// What one collection pass produced, for the log and the dump header.
#[derive(Clone, Copy, Debug, Default)]
pub struct Summary {
    pub competition_matches: f64,
    pub solo_matches: f64,
    pub champions: usize,
    pub new_solo_records: usize,
}

impl Collector {
    /// Reads everything new since the last pass and returns the blended
    /// per-champion records. `solo_weight` scales solo-rank games against
    /// competition games.
    pub fn collect(
        &mut self,
        ctx: &StableServerCtx<'_>,
        solo_weight: f64,
    ) -> (Vec<ChampionRecord>, Summary) {
        let mut competition: BTreeMap<String, Totals> = BTreeMap::new();
        for kind in COMPETITION_KINDS {
            for id in ctx.record_ids(kind) {
                let key = (kind.code(), id);
                if let Some(cached) = self.finished.get(&key) {
                    merge(&mut competition, cached);
                    continue;
                }
                let Some(doc) =
                    ctx.record_get_json(kind, id, "").as_deref().and_then(Value::parse)
                else {
                    continue;
                };
                let contribution = read_competition(&doc);
                merge(&mut competition, &contribution);
                // An in-progress competition still accumulates games, so it
                // is re-read next pass rather than cached.
                if doc.get("finalized").is_some_and(|flag| flag == &Value::Bool(true)) {
                    self.finished.insert(key, contribution);
                }
            }
        }

        let new_solo = self.collect_solo(ctx);

        let mut summary = Summary {
            competition_matches: competition.values().map(|t| t.matches).sum(),
            solo_matches: self.solo.values().map(|t| t.matches).sum(),
            new_solo_records: new_solo,
            champions: 0,
        };

        let weight = solo_weight.max(0.0);
        let mut blended: BTreeMap<String, Totals> = competition;
        for (champion, totals) in &self.solo {
            blended
                .entry(champion.clone())
                .or_default()
                .add(totals.matches * weight, totals.wins * weight);
        }

        summary.champions = blended.len();
        let records = blended
            .into_iter()
            .enumerate()
            .map(|(index, (key, totals))| ChampionRecord {
                champion_id: index,
                key,
                matches: totals.matches,
                wins: totals.wins,
            })
            .collect();
        (records, summary)
    }

    /// Adds every solo-rank match not counted before. Reads only the scalar
    /// fields it needs: these documents carry full per-player stat blocks and
    /// there are thousands of them.
    fn collect_solo(&mut self, ctx: &StableServerCtx<'_>) -> usize {
        let mut added = 0usize;
        for id in ctx.record_ids(RecordKindV1::SoloRankMatch) {
            if !self.counted_solo.insert(id) {
                continue;
            }
            let played = ctx
                .record_get_json(RecordKindV1::SoloRankMatch, id, "played")
                .as_deref()
                .and_then(Value::parse);
            if played != Some(Value::Bool(true)) {
                continue;
            }
            let Some(Value::Bool(blue_won)) = ctx
                .record_get_json(RecordKindV1::SoloRankMatch, id, "blue_team_win")
                .as_deref()
                .and_then(Value::parse)
            else {
                continue;
            };

            for (side, won) in [("blue_team", blue_won), ("red_team", !blue_won)] {
                for slot in 0..MAX_TEAM_SLOTS {
                    let path = format!("{side}.{slot}.champion");
                    let Some(champion) = ctx
                        .record_get_json(RecordKindV1::SoloRankMatch, id, &path)
                        .as_deref()
                        .and_then(Value::parse)
                        .and_then(|value| value.as_str().map(str::to_string))
                    else {
                        // First empty slot ends this side's roster.
                        break;
                    };
                    self.solo
                        .entry(champion)
                        .or_default()
                        .add(1.0, if won { 1.0 } else { 0.0 });
                }
            }
            added += 1;
        }
        added
    }
}

fn merge(into: &mut BTreeMap<String, Totals>, from: &BTreeMap<String, Totals>) {
    for (champion, totals) in from {
        into.entry(champion.clone()).or_default().add(totals.matches, totals.wins);
    }
}

/// Sums `statistics.<athlete>.champion_detail.<champion>.{matches,wins}` over
/// every athlete in one competition document.
pub fn read_competition(doc: &Value) -> BTreeMap<String, Totals> {
    let mut totals: BTreeMap<String, Totals> = BTreeMap::new();
    let Some(statistics) = doc.get("statistics").and_then(Value::as_object) else {
        return totals;
    };
    for athlete in statistics.values() {
        let Some(detail) = athlete.get("champion_detail").and_then(Value::as_object) else {
            continue;
        };
        for (champion, entry) in detail {
            let matches = entry.get("matches").and_then(Value::as_f64).unwrap_or(0.0);
            let wins = entry.get("wins").and_then(Value::as_f64).unwrap_or(0.0);
            // A row that claims more wins than games is not usable.
            if !matches.is_finite() || !wins.is_finite() || matches <= 0.0 || wins > matches {
                continue;
            }
            totals.entry(champion.clone()).or_default().add(matches, wins);
        }
    }
    totals
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_champion_detail_across_athletes() {
        // Shape taken from the real dump: statistics keyed by athlete id,
        // each with a champion_detail map.
        let doc = Value::parse(
            r#"{"finalized":true,"statistics":{
                 "12":{"matches":43,"champion_detail":{
                     "amazon":{"matches":2,"wins":2,"rating":145},
                     "archer":{"matches":5,"wins":1,"rating":90}}},
                 "31":{"matches":40,"champion_detail":{
                     "amazon":{"matches":4,"wins":1,"rating":264}}}}}"#,
        )
        .unwrap();
        let totals = read_competition(&doc);
        assert_eq!(totals["amazon"], Totals { matches: 6.0, wins: 3.0 });
        assert_eq!(totals["archer"], Totals { matches: 5.0, wins: 1.0 });
    }

    #[test]
    fn skips_rows_with_impossible_counts() {
        let doc = Value::parse(
            r#"{"statistics":{"1":{"champion_detail":{
                 "ok":{"matches":3,"wins":2},
                 "bad":{"matches":1,"wins":9},
                 "empty":{"matches":0,"wins":0}}}}}"#,
        )
        .unwrap();
        let totals = read_competition(&doc);
        assert!(totals.contains_key("ok"));
        assert!(!totals.contains_key("bad"));
        assert!(!totals.contains_key("empty"));
    }

    #[test]
    fn a_document_without_statistics_yields_nothing() {
        let doc = Value::parse(r#"{"id":3,"ty":"Masters"}"#).unwrap();
        assert!(read_competition(&doc).is_empty());
    }

    #[test]
    fn merge_accumulates_rather_than_replacing() {
        let mut into = BTreeMap::new();
        into.insert("a".to_string(), Totals { matches: 2.0, wins: 1.0 });
        let mut from = BTreeMap::new();
        from.insert("a".to_string(), Totals { matches: 3.0, wins: 3.0 });
        from.insert("b".to_string(), Totals { matches: 1.0, wins: 0.0 });
        merge(&mut into, &from);
        assert_eq!(into["a"], Totals { matches: 5.0, wins: 4.0 });
        assert_eq!(into["b"], Totals { matches: 1.0, wins: 0.0 });
    }
}
