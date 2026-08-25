//! Binding the tier pipeline to the team document.
//!
//! The stable ABI has no champion-tier slot: tiers live inside the team
//! record, which `team_get_json` / `team_set_json` address by path. A dump
//! from a real save shows the field as
//!
//! ```text
//! champion_tiers: { "amazon": "B", "archer": "C", ... }   // 57 entries
//! ```
//!
//! — champion key to a bare `"S"`/`"A"`/`"B"`/`"C"`/`"D"` label, held
//! **per team**, which is what makes writing to one team leave the rest of
//! the league alone.
//!
//! The search still runs rather than hard-coding that path, so a renamed or
//! restructured field in a later game build degrades to "found nothing and
//! said so" instead of writing to the wrong place. `tier_path` in config
//! pins it outright.

use crate::json::{quote, Value};
use crate::tiers::{Assignment, Tier};

/// Field name the dump shows on a live save. Matching is looser than this
/// (see [`is_tier_key`]); this is what a candidate is preferred for.
pub const KNOWN_TIER_PATH: &str = "champion_tiers";

/// A key can name a champion tier list. Deliberately loose about plural and
/// separator — the first build of this mod looked for `champion_tier` and
/// missed the real `champion_tiers` by one letter.
fn is_tier_key(key: &str) -> bool {
    key.to_ascii_lowercase().replace(['_', '-', ' '], "").contains("tier")
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
    /// `{"fighter": "S", "demon": "B"}` — champion key to tier label. What
    /// the game actually uses.
    MapOfLabels,
    /// `{"fighter": 0, "demon": 2}` — champion key to tier index (S = 0).
    MapOfIndices,
    /// `[["fighter","mage"], ["demon"], ...]` — one bucket per tier.
    BucketArrays,
}

/// What to do with a champion the stats cannot rate.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unrated {
    /// Leave the tier the document already has. The live schema has no
    /// "no tier" value — every champion carries one of S/A/B/C/D — so this
    /// is the default: it keeps the document in a shape the game already
    /// accepts.
    Keep,
    /// Drop the champion from the list entirely.
    Omit,
}

/// Finds the tier field in a team document. `pinned` short-circuits the
/// search when the path is already known from config.
pub fn find_tier_sink(team: &Value, pinned: Option<&str>) -> Option<TierSink> {
    if let Some(path) = pinned.filter(|path| !path.is_empty()) {
        let value = team.path(path)?;
        // A pinned path is an explicit instruction. Infer the shape as best
        // we can instead of refusing over an unexpected value.
        let shape = classify_sink(value).or_else(|| {
            value.as_object().map(|map| {
                if map.values().all(|entry| entry.as_usize().is_some()) {
                    SinkShape::MapOfIndices
                } else {
                    SinkShape::MapOfLabels
                }
            })
        })?;
        return Some(TierSink { path: path.to_string(), shape });
    }
    let mut found = Vec::new();
    search_sink(team, "", &mut found);
    // Prefer the known field name, then the shallowest path, then order.
    found.sort_by_key(|sink| {
        (sink.path != KNOWN_TIER_PATH, sink.path.matches('.').count(), sink.path.len())
    });
    found.into_iter().next()
}

fn search_sink(value: &Value, prefix: &str, found: &mut Vec<TierSink>) {
    let Value::Obj(map) = value else { return };
    for (key, child) in map {
        let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
        if is_tier_key(key) {
            if let Some(shape) = classify_sink(child) {
                found.push(TierSink { path, shape });
                continue;
            }
        }
        search_sink(child, &path, found);
    }
}

fn classify_sink(value: &Value) -> Option<SinkShape> {
    match value {
        // An empty map is the state a team with nothing assigned is in, and
        // filling it is the entire job - refusing it made the mod decline to
        // write in exactly the case it exists for. The shape cannot be read
        // off no entries, so assume the one the live schema uses.
        Value::Obj(map) if map.is_empty() => Some(SinkShape::MapOfLabels),
        Value::Obj(map) => {
            // Tolerant on purpose. A save that another tier mod has already
            // touched carries entries outside S/A/B/C/D - the schema has no
            // "no tier" value, so mods invent one ("", "-", "None"). Demanding
            // every entry be a tier label made the whole field unrecognisable
            // over a single such entry, which is how v0.2 came up empty on a
            // previously modded team while reading pristine AI teams fine.
            let strings = map.values().all(|entry| {
                matches!(entry, Value::Str(_) | Value::Null)
            });
            let labelled = map.values().filter(|entry| {
                entry.as_str().is_some_and(is_tier_label)
            }).count();
            if strings && labelled > 0 {
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

fn is_tier_label(text: &str) -> bool {
    matches!(text.trim().to_ascii_uppercase().as_str(), "S" | "A" | "B" | "C" | "D")
}

/// Every key that looks like a tier list, with why it was or was not
/// accepted. Three releases in a row failed because recognition was too
/// strict and the log only said "found nothing", so the mod now explains
/// itself instead of costing another round trip.
pub fn explain_candidates(team: &Value) -> Vec<String> {
    let mut notes = Vec::new();
    walk_candidates(team, "", &mut notes);
    notes
}

fn walk_candidates(value: &Value, prefix: &str, notes: &mut Vec<String>) {
    const MAX_NOTES: usize = 24;
    let Value::Obj(map) = value else { return };
    for (key, child) in map {
        if notes.len() >= MAX_NOTES {
            return;
        }
        let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
        if is_tier_key(key) {
            notes.push(format!("{path}: {}", describe(child)));
            continue;
        }
        walk_candidates(child, &path, notes);
    }
}

fn describe(value: &Value) -> String {
    match classify_sink(value) {
        Some(shape) => format!("accepted as {shape:?}"),
        None => match value {
            Value::Obj(map) => format!(
                "rejected - object with {} entries, none of which is a tier label \
                 and not all of which are small numbers",
                map.len()
            ),
            Value::Arr(items) => {
                format!("rejected - array of {} entries, not one bucket per tier", items.len())
            }
            other => format!("rejected - a bare {}, not a champion list", other.kind()),
        },
    }
}

/// Builds the JSON to write back, merging the new assignment over what the
/// document already holds so unrated champions keep a valid tier.
pub fn encode_assignment(
    shape: SinkShape,
    assignments: &[Assignment],
    existing: Option<&Value>,
    unrated: Unrated,
) -> String {
    match shape {
        SinkShape::MapOfLabels | SinkShape::MapOfIndices => {
            let mut entries: Vec<(String, String)> = Vec::new();

            if unrated == Unrated::Keep {
                if let Some(map) = existing.and_then(Value::as_object) {
                    for (champion, value) in map {
                        let encoded = match value {
                            Value::Str(label) => quote(label),
                            Value::Num(index) => format!("{index}"),
                            _ => continue,
                        };
                        entries.push((champion.clone(), encoded));
                    }
                }
            }

            for assignment in assignments.iter().filter(|entry| entry.tier != Tier::None) {
                let encoded = encode_tier(shape, assignment.tier);
                match entries.iter_mut().find(|(champion, _)| *champion == assignment.key) {
                    Some(slot) => slot.1 = encoded,
                    None => entries.push((assignment.key.clone(), encoded)),
                }
            }

            // An unrated champion under `Omit` must not survive from the
            // existing document either.
            if unrated == Unrated::Omit {
                entries.retain(|(champion, _)| {
                    assignments
                        .iter()
                        .any(|entry| entry.key == *champion && entry.tier != Tier::None)
                });
            }

            entries.sort_by(|left, right| left.0.cmp(&right.0));
            let body: Vec<String> = entries
                .into_iter()
                .map(|(champion, value)| format!("{}:{value}", quote(&champion)))
                .collect();
            format!("{{{}}}", body.join(","))
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

fn encode_tier(shape: SinkShape, tier: Tier) -> String {
    match shape {
        SinkShape::MapOfIndices => {
            Tier::RANKED.iter().position(|ranked| *ranked == tier).unwrap_or(0).to_string()
        }
        _ => quote(tier.label()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The real field, abbreviated from the schema dump.
    fn live_team() -> Value {
        Value::parse(
            r#"{"champion_personal_tactics":{},
                "champion_tiers":{"amazon":"B","archer":"C","berserker":"D","cf_lux":"S"},
                "merchandise_facility_grade":"S",
                "stadium":{"grade":"S"}}"#,
        )
        .unwrap()
    }

    fn assignment(key: &str, tier: Tier) -> Assignment {
        Assignment { champion_id: 0, key: key.into(), tier, metric: 0.5, matches: 10.0 }
    }

    #[test]
    fn finds_the_live_champion_tiers_field() {
        let sink = find_tier_sink(&live_team(), None).unwrap();
        assert_eq!(sink.path, KNOWN_TIER_PATH);
        assert_eq!(sink.shape, SinkShape::MapOfLabels);
    }

    #[test]
    fn plural_and_separator_variants_all_match() {
        for key in ["champion_tiers", "championTier", "tier_list", "Tiers"] {
            let doc =
                Value::parse(&format!(r#"{{"{key}":{{"a":"S","b":"D"}}}}"#)).unwrap();
            assert!(find_tier_sink(&doc, None).is_some(), "missed {key}");
        }
    }

    #[test]
    fn rejections_explain_themselves() {
        let doc = Value::parse(
            r#"{"champion_tiers":{},"tier_notes":{"a":"needs work"},"coach":{"tier":3}}"#,
        )
        .unwrap();
        let notes = explain_candidates(&doc);
        let joined = notes.join(" | ");
        assert!(joined.contains("champion_tiers: accepted as MapOfLabels"), "{joined}");
        assert!(joined.contains("tier_notes: rejected"), "{joined}");
        assert!(joined.contains("coach.tier: rejected - a bare number"), "{joined}");
    }

    #[test]
    fn an_empty_tier_map_is_the_case_this_mod_exists_for() {
        // A team with nothing assigned stores champion_tiers as {}. Refusing
        // it meant declining to write to precisely the team that needed it.
        let doc = Value::parse(r#"{"name":"T1","champion_tiers":{}}"#).unwrap();
        let sink = find_tier_sink(&doc, None).expect("empty tier map is a valid target");
        assert_eq!(sink.path, KNOWN_TIER_PATH);
        assert_eq!(sink.shape, SinkShape::MapOfLabels);
    }

    #[test]
    fn writing_into_an_empty_map_produces_the_rated_champions() {
        let doc = Value::parse(r#"{"champion_tiers":{}}"#).unwrap();
        let list = [
            assignment("amazon", Tier::S),
            assignment("archer", Tier::C),
            assignment("thin", Tier::None),
        ];
        let written = Value::parse(&encode_assignment(
            SinkShape::MapOfLabels,
            &list,
            doc.path(KNOWN_TIER_PATH),
            Unrated::Keep,
        ))
        .unwrap();
        let entries = written.as_object().unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries["amazon"].as_str(), Some("S"));
        assert_eq!(entries["archer"].as_str(), Some("C"));
    }

    #[test]
    fn a_map_another_mod_left_a_no_tier_value_in_is_still_recognised() {
        // The schema has no "no tier" value, so a mod that wants one invents
        // it. Demanding every entry be S/A/B/C/D made a single such entry
        // hide the entire field.
        for sentinel in [r#""""#, r#""-""#, r#""None""#, r#""No Tier""#, "null"] {
            let doc = Value::parse(&format!(
                r#"{{"champion_tiers":{{"a":"S","b":"C","c":{sentinel},"d":"D"}}}}"#
            ))
            .unwrap();
            let sink = find_tier_sink(&doc, None)
                .unwrap_or_else(|| panic!("sentinel {sentinel} hid the field"));
            assert_eq!(sink.shape, SinkShape::MapOfLabels);
        }
    }

    #[test]
    fn a_map_with_no_tier_label_at_all_is_not_a_tier_list() {
        // Tolerance has a floor: something merely string-valued next to a
        // "tier"-ish key must not be adopted.
        let doc =
            Value::parse(r#"{"tier_notes":{"a":"needs work","b":"solid","c":"unknown"}}"#).unwrap();
        assert_eq!(find_tier_sink(&doc, None), None);
    }

    #[test]
    fn a_foreign_value_survives_a_write_that_does_not_rate_it() {
        let doc =
            Value::parse(r#"{"champion_tiers":{"a":"S","b":"","c":"D"}}"#).unwrap();
        let list = [assignment("a", Tier::B)];
        let written = Value::parse(&encode_assignment(
            SinkShape::MapOfLabels,
            &list,
            doc.path(KNOWN_TIER_PATH),
            Unrated::Keep,
        ))
        .unwrap();
        assert_eq!(written.get("a").unwrap().as_str(), Some("B"));
        assert_eq!(written.get("b").unwrap().as_str(), Some(""));
        assert_eq!(written.get("c").unwrap().as_str(), Some("D"));
    }

    #[test]
    fn a_pinned_path_is_used_even_when_the_shape_is_unfamiliar() {
        let doc = Value::parse(r#"{"weird":{"a":"?","b":"??"}}"#).unwrap();
        let sink = find_tier_sink(&doc, Some("weird")).expect("pinned path honoured");
        assert_eq!(sink.shape, SinkShape::MapOfLabels);
    }

    #[test]
    fn facility_grades_are_not_mistaken_for_tiers() {
        // These sit right next to champion_tiers in the real document and
        // hold bare "S" strings, but they are not tier maps.
        let doc = Value::parse(r#"{"merchandise_facility_grade":"S","stadium":{"grade":"S"}}"#)
            .unwrap();
        assert_eq!(find_tier_sink(&doc, None), None);
    }

    #[test]
    fn a_numeric_tier_rating_is_not_a_champion_list() {
        let doc = Value::parse(r#"{"coach":{"tier":3}}"#).unwrap();
        assert_eq!(find_tier_sink(&doc, None), None);
    }

    #[test]
    fn pinned_path_wins_over_the_search() {
        let doc =
            Value::parse(r#"{"champion_tiers":{"a":"S"},"custom":{"x":"A","y":"D"}}"#).unwrap();
        assert_eq!(find_tier_sink(&doc, Some("custom")).unwrap().path, "custom");
        // An empty pin falls back to searching.
        assert_eq!(find_tier_sink(&doc, Some("")).unwrap().path, KNOWN_TIER_PATH);
    }

    #[test]
    fn keeping_unrated_champions_preserves_their_existing_tier() {
        let team = live_team();
        let existing = team.path(KNOWN_TIER_PATH);
        let list = [assignment("amazon", Tier::S), assignment("archer", Tier::D)];
        let encoded =
            encode_assignment(SinkShape::MapOfLabels, &list, existing, Unrated::Keep);
        let doc = Value::parse(&encoded).unwrap();
        assert_eq!(doc.get("amazon").unwrap().as_str(), Some("S"));
        assert_eq!(doc.get("archer").unwrap().as_str(), Some("D"));
        // Untouched by this run, so they keep what the save had.
        assert_eq!(doc.get("berserker").unwrap().as_str(), Some("D"));
        assert_eq!(doc.get("cf_lux").unwrap().as_str(), Some("S"));
        assert_eq!(doc.as_object().unwrap().len(), 4);
    }

    #[test]
    fn omitting_unrated_champions_drops_them() {
        let team = live_team();
        let list = [assignment("amazon", Tier::A), assignment("archer", Tier::None)];
        let doc = Value::parse(&encode_assignment(
            SinkShape::MapOfLabels,
            &list,
            team.path(KNOWN_TIER_PATH),
            Unrated::Omit,
        ))
        .unwrap();
        assert_eq!(doc.as_object().unwrap().len(), 1);
        assert_eq!(doc.get("amazon").unwrap().as_str(), Some("A"));
    }

    #[test]
    fn a_champion_missing_from_the_save_is_added() {
        let team = live_team();
        let list = [assignment("brand_new_champion", Tier::B)];
        let doc = Value::parse(&encode_assignment(
            SinkShape::MapOfLabels,
            &list,
            team.path(KNOWN_TIER_PATH),
            Unrated::Keep,
        ))
        .unwrap();
        assert_eq!(doc.get("brand_new_champion").unwrap().as_str(), Some("B"));
        assert_eq!(doc.as_object().unwrap().len(), 5);
    }

    #[test]
    fn index_and_bucket_shapes_still_encode() {
        let list = [assignment("a", Tier::S), assignment("b", Tier::C)];
        let indices =
            Value::parse(&encode_assignment(SinkShape::MapOfIndices, &list, None, Unrated::Omit))
                .unwrap();
        assert_eq!(indices.get("b").unwrap().as_usize(), Some(3));

        let buckets =
            Value::parse(&encode_assignment(SinkShape::BucketArrays, &list, None, Unrated::Omit))
                .unwrap();
        assert_eq!(buckets.as_array().unwrap().len(), 5);
        assert_eq!(buckets.path("0.0").unwrap().as_str(), Some("a"));
    }
}
