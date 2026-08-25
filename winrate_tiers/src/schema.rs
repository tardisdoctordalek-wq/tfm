//! Binding the tier pipeline to the game's JSON, whose shape the stable ABI
//! does not document.
//!
//! Both ends are discovered rather than hard-coded:
//!   * the **sink** — where a champion tier list lives inside a team record;
//!   * the **source** — a per-champion table of games played and games won.
//!
//! Discovery is heuristic and deliberately conservative: it reports what it
//! found (for the log and the dump) and gives up rather than writing to a
//! field it is not confident about. `schema_dump.txt` exists so these can be
//! pinned exactly in config once the real layout is known.

use crate::json::Value;
use crate::tiers::ChampionRecord;

/// Keys that plausibly name a champion tier list on a team document.
const TIER_KEYS: [&str; 6] =
    ["championtier", "champion_tier", "tier", "tierlist", "tier_list", "championtierlist"];

/// Keys that plausibly identify a champion inside a stat row.
const CHAMPION_ID_KEYS: [&str; 6] =
    ["champion", "championid", "champion_id", "championkey", "champion_key", "key"];

/// Keys that plausibly hold a games-played count.
const MATCH_COUNT_KEYS: [&str; 8] = [
    "matches", "matchcount", "match_count", "games", "gamecount", "game_count", "play", "playcount",
];

/// Keys that plausibly hold a games-won count.
const WIN_COUNT_KEYS: [&str; 6] = ["wins", "win", "wincount", "win_count", "victory", "victories"];

fn matches_key(key: &str, candidates: &[&str]) -> bool {
    let normalized = key.to_ascii_lowercase();
    candidates.contains(&normalized.as_str())
}

/// Where a tier list was found inside a team document.
#[derive(Clone, Debug, PartialEq)]
pub struct TierSink {
    /// Dot path accepted by `team_get_json` / `team_set_json`.
    pub path: String,
    pub shape: SinkShape,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SinkShape {
    /// `{"fighter": "S", "demon": "B"}` — champion key to tier label.
    MapOfLabels,
    /// `{"fighter": 0, "demon": 2}` — champion key to tier index (S = 0).
    MapOfIndices,
    /// `[["fighter","mage"], ["demon"], ...]` — one bucket per tier.
    BucketArrays,
}

/// Finds the tier field in a team document. `pinned` short-circuits the
/// search when the path is already known from config.
pub fn find_tier_sink(team: &Value, pinned: Option<&str>) -> Option<TierSink> {
    if let Some(path) = pinned {
        let value = team.path(path)?;
        return classify_sink(value).map(|shape| TierSink { path: path.to_string(), shape });
    }
    let mut best: Option<TierSink> = None;
    search_sink(team, "", &mut best);
    best
}

fn search_sink(value: &Value, prefix: &str, best: &mut Option<TierSink>) {
    let Value::Obj(map) = value else { return };
    for (key, child) in map {
        let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
        if matches_key(key, &TIER_KEYS) {
            if let Some(shape) = classify_sink(child) {
                // A shallower hit is more likely to be the real field than
                // one buried inside some nested per-season blob.
                let deeper = best
                    .as_ref()
                    .is_some_and(|found| found.path.matches('.').count() <= path.matches('.').count());
                if !deeper {
                    *best = Some(TierSink { path, shape });
                }
                continue;
            }
        }
        search_sink(child, &path, best);
    }
}

fn classify_sink(value: &Value) -> Option<SinkShape> {
    match value {
        Value::Obj(map) if !map.is_empty() => {
            let all_labels = map.values().all(|entry| {
                entry.as_str().is_some_and(|text| {
                    matches!(text.trim().to_ascii_uppercase().as_str(), "S" | "A" | "B" | "C" | "D")
                })
            });
            if all_labels {
                return Some(SinkShape::MapOfLabels);
            }
            map.values()
                .all(|entry| entry.as_usize().is_some_and(|index| index < 8))
                .then_some(SinkShape::MapOfIndices)
        }
        // Exactly one bucket per tier, each a list of champion keys.
        Value::Arr(items) if (4..=6).contains(&items.len()) => items
            .iter()
            .all(|bucket| {
                bucket.as_array().is_some_and(|keys| keys.iter().all(|key| key.as_str().is_some()))
            })
            .then_some(SinkShape::BucketArrays),
        _ => None,
    }
}

/// A per-champion stat table found somewhere in a record document.
#[derive(Clone, Debug)]
pub struct StatTable {
    pub path: String,
    pub rows: Vec<ChampionRecord>,
}

/// Scans a document for a table carrying, per champion, a games-played and a
/// games-won count. Returns the largest such table — a season-wide table
/// beats a single team's.
pub fn find_stat_table(doc: &Value, pinned: Option<&str>) -> Option<StatTable> {
    if let Some(path) = pinned {
        let value = doc.path(path)?;
        return read_table(value).map(|rows| StatTable { path: path.to_string(), rows });
    }
    let mut best: Option<StatTable> = None;
    search_table(doc, "", &mut best, 0);
    best
}

fn search_table(value: &Value, prefix: &str, best: &mut Option<StatTable>, depth: usize) {
    const MAX_DEPTH: usize = 6;
    if depth > MAX_DEPTH {
        return;
    }
    if let Some(rows) = read_table(value) {
        if best.as_ref().is_none_or(|found| found.rows.len() < rows.len()) {
            *best = Some(StatTable { path: prefix.to_string(), rows });
        }
        return;
    }
    match value {
        Value::Obj(map) => {
            for (key, child) in map {
                let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
                search_table(child, &path, best, depth + 1);
            }
        }
        Value::Arr(items) => {
            for (index, child) in items.iter().enumerate().take(8) {
                search_table(child, &format!("{prefix}.{index}"), best, depth + 1);
            }
        }
        _ => {}
    }
}

/// Reads a stat table in either of its two plausible shapes: an array of row
/// objects, or an object keyed by champion. Needs at least a handful of rows
/// so that an unrelated two-key object is not mistaken for one.
fn read_table(value: &Value) -> Option<Vec<ChampionRecord>> {
    const MIN_ROWS: usize = 4;
    let rows: Vec<ChampionRecord> = match value {
        Value::Arr(items) => items
            .iter()
            .enumerate()
            .filter_map(|(index, item)| read_row(item, None, index))
            .collect(),
        Value::Obj(map) => map
            .iter()
            .enumerate()
            .filter_map(|(index, (key, item))| read_row(item, Some(key), index))
            .collect(),
        _ => return None,
    };
    (rows.len() >= MIN_ROWS).then_some(rows)
}

fn read_row(row: &Value, outer_key: Option<&str>, index: usize) -> Option<ChampionRecord> {
    let map = row.as_object()?;
    let mut matches = None;
    let mut wins = None;
    let mut key_from_row = None;

    for (field, value) in map {
        if matches.is_none() && matches_key(field, &MATCH_COUNT_KEYS) {
            matches = value.as_f64();
        } else if wins.is_none() && matches_key(field, &WIN_COUNT_KEYS) {
            wins = value.as_f64();
        } else if key_from_row.is_none() && matches_key(field, &CHAMPION_ID_KEYS) {
            key_from_row = value.as_str().map(str::to_string).or_else(|| {
                value.as_usize().map(|id| id.to_string())
            });
        }
    }

    let matches = matches?;
    let wins = wins?;
    // A row claiming more wins than games is not a win/loss table.
    if !matches.is_finite() || !wins.is_finite() || matches < 0.0 || wins < 0.0 || wins > matches {
        return None;
    }
    let key = key_from_row.or_else(|| outer_key.map(str::to_string))?;
    Some(ChampionRecord { champion_id: index, key, matches, wins })
}

/// Renders a tier assignment into the shape the sink expects.
pub fn encode_assignment(
    shape: SinkShape,
    assignments: &[crate::tiers::Assignment],
) -> String {
    use crate::json::quote;
    use crate::tiers::Tier;

    match shape {
        SinkShape::MapOfLabels | SinkShape::MapOfIndices => {
            let entries: Vec<String> = assignments
                .iter()
                // A champion with no tier is left out rather than written as
                // some sentinel the game may not accept.
                .filter(|entry| entry.tier != Tier::None)
                .map(|entry| {
                    let value = match shape {
                        SinkShape::MapOfIndices => {
                            Tier::RANKED.iter().position(|t| *t == entry.tier).unwrap_or(0).to_string()
                        }
                        _ => quote(entry.tier.label()),
                    };
                    format!("{}:{}", quote(&entry.key), value)
                })
                .collect();
            format!("{{{}}}", entries.join(","))
        }
        SinkShape::BucketArrays => {
            let buckets: Vec<String> = Tier::RANKED
                .iter()
                .map(|tier| {
                    let keys: Vec<String> = assignments
                        .iter()
                        .filter(|entry| entry.tier == *tier)
                        .map(|entry| quote(&entry.key))
                        .collect();
                    format!("[{}]", keys.join(","))
                })
                .collect();
            format!("[{}]", buckets.join(","))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tiers::{Assignment, Tier};

    #[test]
    fn finds_a_label_map_tier_field() {
        let team = Value::parse(
            r#"{"name":"T1","draft":{"championTier":{"fighter":"S","mage":"C"}},"budget":100}"#,
        )
        .unwrap();
        let sink = find_tier_sink(&team, None).unwrap();
        assert_eq!(sink.path, "draft.championTier");
        assert_eq!(sink.shape, SinkShape::MapOfLabels);
    }

    #[test]
    fn finds_bucket_array_tier_field() {
        let team =
            Value::parse(r#"{"tier_list":[["a","b"],["c"],[],["d"],["e"]]}"#).unwrap();
        let sink = find_tier_sink(&team, None).unwrap();
        assert_eq!(sink.shape, SinkShape::BucketArrays);
    }

    #[test]
    fn ignores_a_tier_key_of_the_wrong_shape() {
        // A staff "tier" rating is a bare number, not a champion list.
        let team = Value::parse(r#"{"coach":{"tier":3}}"#).unwrap();
        assert_eq!(find_tier_sink(&team, None), None);
    }

    #[test]
    fn pinned_path_wins_over_the_search() {
        let team = Value::parse(
            r#"{"tier":{"a":"S","b":"B"},"custom":{"slot":{"x":"A","y":"D"}}}"#,
        )
        .unwrap();
        let sink = find_tier_sink(&team, Some("custom.slot")).unwrap();
        assert_eq!(sink.path, "custom.slot");
    }

    #[test]
    fn reads_an_array_stat_table() {
        let doc = Value::parse(
            r#"{"season":{"championStats":[
                 {"champion":"fighter","matches":100,"wins":55},
                 {"champion":"mage","matches":80,"wins":36},
                 {"champion":"demon","matches":60,"wins":31},
                 {"champion":"tank","matches":40,"wins":18}]}}"#,
        )
        .unwrap();
        let table = find_stat_table(&doc, None).unwrap();
        assert_eq!(table.path, "season.championStats");
        assert_eq!(table.rows.len(), 4);
        assert_eq!(table.rows[0].key, "fighter");
        assert_eq!(table.rows[0].wins, 55.0);
    }

    #[test]
    fn reads_an_object_keyed_stat_table() {
        let doc = Value::parse(
            r#"{"stats":{"fighter":{"games":10,"win":6},"mage":{"games":9,"win":4},
                        "demon":{"games":8,"win":5},"tank":{"games":7,"win":2}}}"#,
        )
        .unwrap();
        let table = find_stat_table(&doc, None).unwrap();
        assert_eq!(table.rows.len(), 4);
        assert!(table.rows.iter().any(|row| row.key == "mage" && row.matches == 9.0));
    }

    #[test]
    fn rejects_a_table_whose_wins_exceed_its_games() {
        let doc = Value::parse(
            r#"{"x":[{"champion":"a","matches":1,"wins":9},{"champion":"b","matches":1,"wins":9},
                    {"champion":"c","matches":1,"wins":9},{"champion":"d","matches":1,"wins":9}]}"#,
        )
        .unwrap();
        assert!(find_stat_table(&doc, None).is_none());
    }

    #[test]
    fn prefers_the_larger_table() {
        let doc = Value::parse(
            r#"{"small":[{"champion":"a","matches":5,"wins":2},{"champion":"b","matches":5,"wins":2},
                        {"champion":"c","matches":5,"wins":2},{"champion":"d","matches":5,"wins":2}],
                "big":[{"champion":"a","matches":5,"wins":2},{"champion":"b","matches":5,"wins":2},
                       {"champion":"c","matches":5,"wins":2},{"champion":"d","matches":5,"wins":2},
                       {"champion":"e","matches":5,"wins":2}]}"#,
        )
        .unwrap();
        assert_eq!(find_stat_table(&doc, None).unwrap().rows.len(), 5);
    }

    fn assignment(key: &str, tier: Tier) -> Assignment {
        Assignment { champion_id: 0, key: key.to_string(), tier, metric: 0.5, matches: 10.0 }
    }

    #[test]
    fn encodes_each_sink_shape_as_valid_json() {
        let list = [
            assignment("fighter", Tier::S),
            assignment("mage", Tier::C),
            assignment("thin", Tier::None),
        ];
        let labels = encode_assignment(SinkShape::MapOfLabels, &list);
        assert_eq!(Value::parse(&labels).unwrap().get("fighter").unwrap().as_str(), Some("S"));
        // No-tier champions stay out of the written document.
        assert!(Value::parse(&labels).unwrap().get("thin").is_none());

        let indices = encode_assignment(SinkShape::MapOfIndices, &list);
        assert_eq!(Value::parse(&indices).unwrap().get("mage").unwrap().as_usize(), Some(3));

        let buckets = Value::parse(&encode_assignment(SinkShape::BucketArrays, &list)).unwrap();
        assert_eq!(buckets.as_array().unwrap().len(), 5);
        assert_eq!(buckets.path("0.0").unwrap().as_str(), Some("fighter"));
    }
}
