//! Schema probe.
//!
//! The stable ABI hands out game records as JSON blobs but does not document
//! their shape, and it has no champion-tier slot — tiers live somewhere
//! inside the team document. This module writes one report of everything the
//! server side can see, so the exact paths can be pinned instead of guessed.
//!
//! It runs once per session (or on every recompute with `dump=true`) and is
//! read-only: it never writes to a record.

use std::fmt::Write as _;
use std::path::Path;

use mod_api_stable::{RecordKindV1, SettingTargetV1, StableServerCtx};

use crate::json::{self, Value};

/// Record kinds worth dumping, with the names the report labels them by.
const KINDS: &[(RecordKindV1, &str)] = &[
    (RecordKindV1::Team, "Team"),
    (RecordKindV1::Athlete, "Athlete"),
    (RecordKindV1::League, "League"),
    (RecordKindV1::Tournament, "Tournament"),
    (RecordKindV1::Staff, "Staff"),
    (RecordKindV1::MatchNormal, "MatchNormal"),
    (RecordKindV1::MatchSoloRank, "MatchSoloRank"),
    (RecordKindV1::LeagueCompetition, "LeagueCompetition"),
    (RecordKindV1::TournamentCompetition, "TournamentCompetition"),
    (RecordKindV1::SoloRankMatch, "SoloRankMatch"),
    (RecordKindV1::KnowledgeBase, "KnowledgeBase"),
    (RecordKindV1::YearSchedule, "YearSchedule"),
    (RecordKindV1::Match, "Match"),
    (RecordKindV1::MatchReplay, "MatchReplay"),
];

/// Full documents are dumped for the first record of a kind only; the rest
/// contribute their key outline. A season of match records is large.
const FULL_SAMPLES: usize = 2;
const MAX_DOC_CHARS: usize = 24_000;

pub fn write_report(ctx: &StableServerCtx<'_>, dir: &Path, player_team: Option<usize>) -> Option<()> {
    let mut out = String::new();
    let _ = writeln!(out, "# {} schema dump", crate::MOD_ID);
    let _ = writeln!(out, "# Generated so the tier/stat JSON paths can be pinned exactly.");
    let _ = writeln!(out, "# Read-only: nothing here modifies a record.\n");

    let _ = writeln!(out, "player_team_id (probed over player ids 0..8):");
    for player_id in 0..8usize {
        if let Some(team) = ctx.player_team_id(player_id) {
            let _ = writeln!(out, "  player {player_id} -> team {team}");
        }
    }
    let _ = writeln!(out, "  resolved player team: {player_team:?}\n");

    dump_settings(ctx, &mut out);

    for (kind, name) in KINDS {
        dump_kind(ctx, *kind, name, &mut out);
    }

    if let Some(team_id) = player_team {
        let _ = writeln!(out, "\n{}", "=".repeat(76));
        let _ = writeln!(out, "TIER-FIELD CANDIDATES in the player's team document (team {team_id})");
        let _ = writeln!(out, "{}", "=".repeat(76));
        match ctx.team_get_json(team_id, "").as_deref().and_then(Value::parse) {
            Some(doc) => {
                let mut hits = Vec::new();
                find_candidates(&doc, "", &mut hits);
                if hits.is_empty() {
                    let _ = writeln!(out, "  (no key matching tier/champion/grade found)");
                }
                for (path, description) in hits {
                    let _ = writeln!(out, "  {path}\n      {description}");
                }
                // The player's team is the one actually written to, and its
                // document is the one that matters, so it goes out in full
                // rather than clamped into this report.
                if let Some(raw) = ctx.team_get_json(team_id, "") {
                    let path = dir.join("player_team.json");
                    match std::fs::write(&path, &raw) {
                        Ok(()) => {
                            let _ = writeln!(out, "\n  full document written to {}", path.display());
                        }
                        Err(error) => {
                            let _ = writeln!(out, "\n  could not write player_team.json: {error}");
                        }
                    }
                }
            }
            None => {
                let _ = writeln!(out, "  team_get_json(team, \"\") returned nothing or unparsable JSON");
            }
        }
    }

    std::fs::write(dir.join("schema_dump.txt"), out).ok()
}

fn dump_settings(ctx: &StableServerCtx<'_>, out: &mut String) {
    for (target, name) in
        [(SettingTargetV1::GameSetting, "GameSetting"), (SettingTargetV1::ItemSetting, "ItemSetting")]
    {
        let _ = writeln!(out, "\n{}", "=".repeat(76));
        let _ = writeln!(out, "SETTING {name}");
        let _ = writeln!(out, "{}", "=".repeat(76));
        match ctx.setting_get_json(target, "") {
            Some(raw) => match Value::parse(&raw) {
                Some(doc) => {
                    let _ = writeln!(out, "{}", outline(&doc));
                    let _ = writeln!(out, "\n-- full document --\n{}", clamp(&json::pretty(&doc)));
                }
                None => {
                    let _ = writeln!(out, "(unparsable) {}", clamp(&raw));
                }
            },
            None => {
                let _ = writeln!(out, "(slot returned nothing)");
            }
        }
    }
}

fn dump_kind(ctx: &StableServerCtx<'_>, kind: RecordKindV1, name: &str, out: &mut String) {
    let ids = ctx.record_ids(kind);
    let _ = writeln!(out, "\n{}", "=".repeat(76));
    let _ = writeln!(out, "RECORD {name} (code {}) - {} record(s)", kind.code(), ids.len());
    let _ = writeln!(out, "{}", "=".repeat(76));
    if ids.is_empty() {
        return;
    }
    let _ = writeln!(
        out,
        "ids: {}{}",
        ids.iter().take(24).map(usize::to_string).collect::<Vec<_>>().join(", "),
        if ids.len() > 24 { ", ..." } else { "" }
    );

    for id in ids.iter().take(FULL_SAMPLES) {
        let Some(raw) = ctx.record_get_json(kind, *id, "") else {
            let _ = writeln!(out, "\n-- record {id}: slot returned nothing --");
            continue;
        };
        let _ = writeln!(out, "\n-- record {id} --");
        match Value::parse(&raw) {
            Some(doc) => {
                let _ = writeln!(out, "outline:\n{}", outline(&doc));
                let _ = writeln!(out, "document:\n{}", clamp(&json::pretty(&doc)));
            }
            None => {
                let _ = writeln!(out, "(unparsable) {}", clamp(&raw));
            }
        }
    }
}

/// A compact "key: type" tree — enough to see the shape of a document whose
/// full text would be far too long to read.
fn outline(value: &Value) -> String {
    let mut out = String::new();
    write_outline(value, "", 1, &mut out);
    out
}

fn write_outline(value: &Value, prefix: &str, depth: usize, out: &mut String) {
    const MAX_DEPTH: usize = 4;
    const MAX_KEYS: usize = 60;
    let pad = "  ".repeat(depth);
    match value {
        Value::Obj(map) => {
            for (index, (key, child)) in map.iter().enumerate() {
                if index == MAX_KEYS {
                    let _ = writeln!(out, "{pad}... ({} more keys)", map.len() - MAX_KEYS);
                    break;
                }
                let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
                let _ = writeln!(out, "{pad}{path}: {}{}", child.kind(), summary(child));
                if depth < MAX_DEPTH {
                    write_outline(child, &path, depth + 1, out);
                }
            }
        }
        Value::Arr(items) => {
            // Arrays are homogeneous in practice; one element shows the shape.
            if let Some(first) = items.first() {
                let path = format!("{prefix}.0");
                let _ = writeln!(out, "{pad}{path}: {}{}", first.kind(), summary(first));
                if depth < MAX_DEPTH {
                    write_outline(first, &path, depth + 1, out);
                }
            }
        }
        _ => {}
    }
}

fn summary(value: &Value) -> String {
    match value {
        Value::Arr(items) => format!(" (len {})", items.len()),
        // The distinct values matter as much as the key count: whether a
        // champion-tier map holds only S/A/B/C/D or something a previous mod
        // left behind decides whether this field is recognised at all.
        Value::Obj(map) => format!(" ({} keys){}", map.len(), distinct_values(map)),
        Value::Str(s) if s.chars().count() <= 40 => format!(" = {}", json::quote(s)),
        Value::Str(_) => " = <long string>".to_string(),
        Value::Num(n) => format!(" = {n}"),
        Value::Bool(b) => format!(" = {b}"),
        Value::Null => String::new(),
    }
}

/// Flags any key that plausibly holds a champion tier list, with a note on
/// what the value looks like.
fn find_candidates(value: &Value, prefix: &str, hits: &mut Vec<(String, String)>) {
    const NEEDLES: [&str; 4] = ["tier", "grade", "champion", "rank"];
    const MAX_HITS: usize = 40;
    if hits.len() >= MAX_HITS {
        return;
    }
    match value {
        Value::Obj(map) => {
            for (key, child) in map {
                let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
                let lowered = key.to_ascii_lowercase();
                if NEEDLES.iter().any(|needle| lowered.contains(needle)) {
                    hits.push((path.clone(), format!("{}{}", child.kind(), summary(child))));
                }
                find_candidates(child, &path, hits);
            }
        }
        Value::Arr(items) => {
            if let Some(first) = items.first() {
                find_candidates(first, &format!("{prefix}.0"), hits);
            }
        }
        _ => {}
    }
}

/// Up to eight distinct scalar values in an object, for the candidate list.
fn distinct_values(map: &std::collections::BTreeMap<String, Value>) -> String {
    const MAX_SHOWN: usize = 8;
    let mut seen: Vec<String> = Vec::new();
    let mut scalars = 0usize;
    for value in map.values() {
        let rendered = match value {
            Value::Str(text) => json::quote(text),
            Value::Num(number) => number.to_string(),
            Value::Bool(flag) => flag.to_string(),
            Value::Null => "null".to_string(),
            _ => continue,
        };
        scalars += 1;
        if !seen.contains(&rendered) && seen.len() < MAX_SHOWN {
            seen.push(rendered);
        }
    }
    if seen.is_empty() || scalars < map.len() {
        return String::new();
    }
    format!(" values: {}{}", seen.join(", "), if seen.len() == MAX_SHOWN { ", ..." } else { "" })
}

fn clamp(text: &str) -> String {
    if text.len() <= MAX_DOC_CHARS {
        return text.to_string();
    }
    let mut end = MAX_DOC_CHARS;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n... (truncated, {} bytes total)", &text[..end], text.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidate_summary_shows_the_distinct_values() {
        // A map another mod left a non-standard entry in: seeing that value
        // is the whole point of the candidate listing.
        let doc = Value::parse(r#"{"champion_tiers":{"a":"S","b":"D","c":"","d":"S"}}"#).unwrap();
        let mut hits = Vec::new();
        find_candidates(&doc, "", &mut hits);
        let (_, description) = hits.iter().find(|(path, _)| path == "champion_tiers").unwrap();
        assert!(description.contains("4 keys"), "{description}");
        assert!(description.contains(r#""S""#), "{description}");
        assert!(description.contains(r#""""#), "{description}");
    }

    #[test]
    fn nested_objects_do_not_get_a_value_list() {
        let doc = Value::parse(r#"{"tier":{"a":{"x":1}}}"#).unwrap();
        let mut hits = Vec::new();
        find_candidates(&doc, "", &mut hits);
        let (_, description) = hits.iter().find(|(path, _)| path == "tier").unwrap();
        assert!(!description.contains("values:"), "{description}");
    }

    #[test]
    fn outline_reports_shape_not_bulk() {
        let doc = Value::parse(r#"{"name":"T1","roster":[{"id":1,"name":"a"},{"id":2}]}"#).unwrap();
        let text = outline(&doc);
        assert!(text.contains("roster: array (len 2)"));
        assert!(text.contains("roster.0.id: number = 1"));
    }

    #[test]
    fn candidate_search_finds_nested_tier_keys() {
        let doc =
            Value::parse(r#"{"a":{"championTier":{"fighter":"S"}},"b":[{"tier_list":[1,2]}]}"#)
                .unwrap();
        let mut hits = Vec::new();
        find_candidates(&doc, "", &mut hits);
        let paths: Vec<_> = hits.iter().map(|(path, _)| path.as_str()).collect();
        assert!(paths.contains(&"a.championTier"));
        assert!(paths.contains(&"b.0.tier_list"));
    }

    #[test]
    fn clamp_cuts_on_a_char_boundary() {
        let text = "한".repeat(MAX_DOC_CHARS);
        let clamped = clamp(&text);
        assert!(clamped.contains("truncated"));
        // Would have panicked on a mid-character split before reaching here.
        assert!(clamped.chars().count() > 0);
    }
}
