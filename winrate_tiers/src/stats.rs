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
//! * **Replay** — `MatchReplay` is one document per game of a competition
//!   match, and unlike the aggregates it carries `version`, the balance patch
//!   the game was played under. Reading champions and the result from here is
//!   the only way to split competition history by patch. Using it *replaces*
//!   the aggregate above; counting both would count every game twice.
//!
//! * **Solo rank** — `SoloRankMatch` is one document per match:
//!   `blue_team[]`/`red_team[]` rows each name a `champion`, and
//!   `blue_team_win` says who won. These documents are large and there are
//!   thousands of them, so only the handful of scalar fields that matter are
//!   read by path, and each match id is counted once and remembered.

use std::collections::{BTreeMap, BTreeSet};

use mod_api_stable::{RecordKindV1, StableServerCtx};

use crate::json::Value;
use crate::patch::{self, Patches};
use crate::tiers::ChampionRecord;

/// Competition record kinds carrying `statistics.<athlete>.champion_detail`.
const COMPETITION_KINDS: [RecordKindV1; 2] =
    [RecordKindV1::LeagueCompetition, RecordKindV1::TournamentCompetition];

/// Upper bound on players scanned per side of a solo-rank match. Team size
/// varies with the game rule (5v5, 3v3, 2v2); the scan stops at the first
/// missing slot and this only guards against a runaway loop.
const MAX_TEAM_SLOTS: usize = 10;

/// Where competition win rates come from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    /// Per-game `MatchReplay` documents. Carries the balance patch, so patch
    /// weighting works; costs one scan of the replay table on first use.
    Replay,
    /// `champion_detail` aggregates on the competition records. Cheap, but
    /// they carry no patch information at all.
    Summary,
}

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

    fn scaled(self, factor: f64) -> Self {
        Self { matches: self.matches * factor, wins: self.wins * factor }
    }

    fn plus(self, other: Self) -> Self {
        Self { matches: self.matches + other.matches, wins: self.wins + other.wins }
    }
}

/// One source split into the two patches that count.
#[derive(Default)]
struct Split {
    current: BTreeMap<String, Totals>,
    previous: BTreeMap<String, Totals>,
}

impl Split {
    fn champions(&self) -> impl Iterator<Item = &String> {
        self.current.keys().chain(self.previous.keys())
    }

    fn get(&self, champion: &str) -> (Totals, Totals) {
        (
            self.current.get(champion).copied().unwrap_or_default(),
            self.previous.get(champion).copied().unwrap_or_default(),
        )
    }
}

/// Effective per-champion sample: current patch plus the previous one at its
/// faded weight, with solo-rank games folded in at `solo_weight`.
///
/// This is the blend the original `draft_winrate_penalty` mod documented, and
/// the reason it needs no threshold: the fade is computed per champion from
/// that champion's own coverage.
fn blend(
    competition: &Split,
    solo: &Split,
    contest: &Contest,
    params: &Params,
) -> BTreeMap<String, (Totals, f64)> {
    let weight = params.solo_weight.max(0.0);
    let mut blended = BTreeMap::new();
    let champions: BTreeSet<&String> = competition.champions().chain(solo.champions()).collect();
    for champion in champions {
        let (comp_current, comp_previous) = competition.get(champion);
        let (solo_current, solo_previous) = solo.get(champion);
        let current = comp_current.plus(solo_current.scaled(weight));
        let previous = comp_previous.plus(solo_previous.scaled(weight));
        let fade = patch::previous_fade(
            current.matches,
            previous.matches,
            params.prev_weight,
            params.confidence_k,
        );
        let effective = current.plus(previous.scaled(fade));
        if effective.matches > 0.0 {
            let presence = contest.presence(champion, comp_current.matches, comp_previous.matches, fade);
            blended.insert(champion.clone(), (effective, presence));
        }
    }
    blended
}

/// Bans and game counts for the two patches in force — the denominator and
/// the ban half of presence.
#[derive(Default)]
struct Contest {
    current_bans: BTreeMap<String, f64>,
    previous_bans: BTreeMap<String, f64>,
    current_games: f64,
    previous_games: f64,
}

impl Contest {
    /// Share of competition games in which the champion was picked or banned,
    /// blending the two patches on the same fade as the win rate.
    fn presence(&self, champion: &str, picks_current: f64, picks_previous: f64, fade: f64) -> f64 {
        let games = self.current_games + self.previous_games * fade;
        if games <= 0.0 {
            // With no games to measure against, presence cannot rule anything
            // out - report full presence rather than gating every champion.
            return 1.0;
        }
        let bans = self.current_bans.get(champion).copied().unwrap_or(0.0)
            + self.previous_bans.get(champion).copied().unwrap_or(0.0) * fade;
        let picks = picks_current + picks_previous * fade;
        // Ten champions are picked per game, so picks are divided by the
        // games they were drawn from, not by picks overall.
        ((picks + bans) / games).min(1.0)
    }
}

fn bucket_of(
    buckets: &BTreeMap<String, BTreeMap<String, f64>>,
    version: &Option<String>,
) -> BTreeMap<String, f64> {
    version.as_ref().and_then(|version| buckets.get(version)).cloned().unwrap_or_default()
}

fn count_of(counts: &BTreeMap<String, f64>, version: &Option<String>) -> f64 {
    version.as_ref().and_then(|version| counts.get(version)).copied().unwrap_or(0.0)
}

/// Picks the current and previous patch buckets out of a versioned source.
fn select(
    buckets: &BTreeMap<String, BTreeMap<String, Totals>>,
    patches: &Patches,
) -> Split {
    let bucket = |version: &Option<String>| {
        version
            .as_ref()
            .and_then(|version| buckets.get(version))
            .cloned()
            .unwrap_or_default()
    };
    Split { current: bucket(&patches.current), previous: bucket(&patches.previous) }
}

/// Collapses every patch bucket into one table, for the unversioned path.
fn flatten(buckets: &BTreeMap<String, BTreeMap<String, Totals>>) -> Split {
    let mut current: BTreeMap<String, Totals> = BTreeMap::new();
    for champions in buckets.values() {
        merge(&mut current, champions);
    }
    Split { current, previous: BTreeMap::new() }
}

/// Running aggregate. Kept across recomputes so the expensive first pass is
/// not repeated: finished competitions and played solo matches never change.
#[derive(Default)]
pub struct Collector {
    /// Per-competition contribution, keyed by (record kind code, record id).
    /// Cached only once the competition reports `finalized`.
    finished: BTreeMap<(u32, usize), BTreeMap<String, Totals>>,
    /// Competition games from replays, bucketed by balance patch.
    replay: BTreeMap<String, BTreeMap<String, Totals>>,
    /// Bans per champion per patch. A champion banned out of a draft is being
    /// respected, not ignored, so bans count toward presence alongside picks.
    bans: BTreeMap<String, BTreeMap<String, f64>>,
    /// Games read per patch — the denominator presence is measured against.
    games: BTreeMap<String, f64>,
    counted_replays: BTreeSet<usize>,
    /// Solo-rank games, bucketed the same way.
    solo: BTreeMap<String, BTreeMap<String, Totals>>,
    counted_solo: BTreeSet<usize>,
}

/// What one collection pass produced, for the log and the dump header.
#[derive(Clone, Debug, Default)]
pub struct Summary {
    /// Current-patch competition games.
    pub competition_matches: f64,
    /// Previous-patch competition games, before the fade is applied.
    pub previous_matches: f64,
    pub solo_matches: f64,
    pub champions: usize,
    pub new_records: usize,
    /// Records still unread, when a scan is spread over several passes.
    pub remaining: usize,
    /// The patches in force, empty under `Source::Summary`.
    pub patches: String,
}

/// Settings one collection pass needs.
#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub source: Source,
    pub solo_weight: f64,
    /// Maximum weight the previous patch can carry. The fade in
    /// [`patch::previous_fade`] scales it down per champion.
    pub prev_weight: f64,
    /// Confidence factor the fade shares with the tier metric.
    pub confidence_k: f64,
    /// Records read per pass. Scanning the whole replay table at once stalls
    /// a management tick, so it is spread over several; 0 lifts the limit.
    pub budget: usize,
}

impl Collector {
    /// Reads what the budget allows and returns the per-champion records.
    pub fn collect(&mut self, ctx: &StableServerCtx<'_>, params: &Params) -> (Vec<ChampionRecord>, Summary) {
        let mut budget = if params.budget == 0 { usize::MAX } else { params.budget };
        let mut summary = Summary::default();

        let competition = match params.source {
            Source::Summary => Split { current: self.collect_summary(ctx), previous: BTreeMap::new() },
            Source::Replay => {
                let (added, remaining) = self.scan(
                    ctx,
                    RecordKindV1::MatchReplay,
                    &mut budget,
                    Scan::Replay,
                );
                summary.new_records += added;
                summary.remaining += remaining;
                Split::default()
            }
        };

        let (added, remaining) =
            self.scan(ctx, RecordKindV1::SoloRankMatch, &mut budget, Scan::Solo);
        summary.new_records += added;
        summary.remaining += remaining;

        // Patch weighting only means anything when the source carries a
        // version, so the summary path treats everything as current.
        let (competition, solo, patches) = match params.source {
            Source::Summary => (competition, flatten(&self.solo), Patches::default()),
            Source::Replay => {
                let patches = Patches::identify(
                    self.replay.keys().chain(self.solo.keys()).cloned(),
                );
                (
                    select(&self.replay, &patches),
                    select(&self.solo, &patches),
                    patches
                )
            }
        };
        summary.patches = patches.describe();

        let contest = match params.source {
            Source::Replay => Contest {
                current_bans: bucket_of(&self.bans, &patches.current),
                previous_bans: bucket_of(&self.bans, &patches.previous),
                current_games: count_of(&self.games, &patches.current),
                previous_games: count_of(&self.games, &patches.previous),
            },
            // The aggregates carry no bans and no game count; every game
            // seats ten champions, so the count is recoverable from the picks.
            Source::Summary => Contest {
                current_games: competition.current.values().map(|t| t.matches).sum::<f64>() / 10.0,
                ..Contest::default()
            },
        };
        let blended = blend(&competition, &solo, &contest, params);

        summary.competition_matches = competition.current.values().map(|t| t.matches).sum();
        summary.previous_matches = competition.previous.values().map(|t| t.matches).sum();
        summary.solo_matches = solo.current.values().map(|t| t.matches).sum();

        summary.champions = blended.len();
        let records = blended
            .into_iter()
            .enumerate()
            .map(|(index, (key, (totals, presence)))| ChampionRecord {
                champion_id: index,
                key,
                matches: totals.matches,
                wins: totals.wins,
                presence,
            })
            .collect();
        (records, summary)
    }

    /// Sums `champion_detail` over the competition records, caching whichever
    /// competitions report `finalized`.
    fn collect_summary(&mut self, ctx: &StableServerCtx<'_>) -> BTreeMap<String, Totals> {
        let mut competition: BTreeMap<String, Totals> = BTreeMap::new();
        for kind in COMPETITION_KINDS {
            for id in ctx.record_ids(kind) {
                let key = (kind.code(), id);
                if let Some(cached) = self.finished.get(&key) {
                    merge(&mut competition, cached);
                    continue;
                }
                let Some(doc) = ctx.record_get_json(kind, id, "").as_deref().and_then(Value::parse)
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
        competition
    }

    /// Adds up to `budget` unread match documents of one kind. Returns how
    /// many were read and how many are still outstanding.
    ///
    /// Only the scalar fields that matter are read by path: these documents
    /// carry full per-player stat blocks and there are thousands of them.
    fn scan(
        &mut self,
        ctx: &StableServerCtx<'_>,
        kind: RecordKindV1,
        budget: &mut usize,
        which: Scan,
    ) -> (usize, usize) {
        let (added, mut remaining) = (&mut 0usize, 0usize);
        for id in ctx.record_ids(kind) {
            let counted = match which {
                Scan::Replay => &self.counted_replays,
                Scan::Solo => &self.counted_solo,
            };
            if counted.contains(&id) {
                continue;
            }
            if *budget == 0 {
                remaining += 1;
                continue;
            }
            *budget -= 1;
            *added += 1;
            match which {
                Scan::Replay => {
                    self.counted_replays.insert(id);
                }
                Scan::Solo => {
                    self.counted_solo.insert(id);
                }
            }

            let Some(game) = read_game(ctx, kind, id, which) else { continue };
            if which == Scan::Replay {
                *self.games.entry(game.version.clone()).or_default() += 1.0;
                let banned = self.bans.entry(game.version.clone()).or_default();
                for champion in game.bans {
                    *banned.entry(champion).or_default() += 1.0;
                }
            }
            let bucket = match which {
                Scan::Replay => &mut self.replay,
                Scan::Solo => &mut self.solo,
            };
            let per_champion = bucket.entry(game.version).or_default();
            for (champion, won) in game.picks {
                per_champion
                    .entry(champion)
                    .or_default()
                    .add(1.0, if won { 1.0 } else { 0.0 });
            }
        }
        (*added, remaining)
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Scan {
    Replay,
    Solo,
}

struct Game {
    version: String,
    picks: Vec<(String, bool)>,
    bans: Vec<String>,
}

/// Reads one match document: which patch, and which champion was on the
/// winning side. `MatchReplay` and `SoloRankMatch` share this shape.
fn read_game(
    ctx: &StableServerCtx<'_>,
    kind: RecordKindV1,
    id: usize,
    which: Scan,
) -> Option<Game> {
    let scalar = |path: &str| {
        ctx.record_get_json(kind, id, path).as_deref().and_then(Value::parse)
    };

    // Solo-rank documents include scheduled matches that have not happened.
    if which == Scan::Solo && scalar("played") != Some(Value::Bool(true)) {
        return None;
    }
    let Some(Value::Bool(blue_won)) = scalar("blue_team_win") else { return None };
    // A document with no version cannot be placed in a patch. Replays carry
    // one; if that ever changes, the game is skipped rather than misfiled.
    let version = scalar("version")?.as_str()?.to_string();

    let mut picks = Vec::new();
    for (side, won) in [("blue_team", blue_won), ("red_team", !blue_won)] {
        for slot in 0..MAX_TEAM_SLOTS {
            let Some(champion) = scalar(&format!("{side}.{slot}.champion"))
                .and_then(|value| value.as_str().map(str::to_string))
            else {
                // The first empty slot ends this side's roster.
                break;
            };
            picks.push((champion, won));
        }
    }

    // Solo-rank documents have no ban phase; competition replays do.
    let mut bans = Vec::new();
    for side in ["blue_ban", "red_ban"] {
        for slot in 0..MAX_TEAM_SLOTS {
            let Some(champion) = scalar(&format!("{side}.{slot}"))
                .and_then(|value| value.as_str().map(str::to_string))
            else {
                break;
            };
            bans.push(champion);
        }
    }

    (!picks.is_empty()).then_some(Game { version, picks, bans })
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

    fn params(prev_weight: f64, solo_weight: f64) -> Params {
        Params {
            source: Source::Replay,
            solo_weight,
            prev_weight,
            confidence_k: 50.0,
            budget: 0,
        }
    }

    /// Enough games that presence never gates a blend test; the presence
    /// gate has its own tests in `tiers`.
    fn open_contest() -> Contest {
        Contest { current_games: 0.0, ..Contest::default() }
    }

    fn totals_of(
        blended: &BTreeMap<String, (Totals, f64)>,
        champion: &str,
    ) -> Totals {
        blended.get(champion).expect("champion present").0
    }

    fn split(current: &[(&str, f64, f64)], previous: &[(&str, f64, f64)]) -> Split {
        let table = |rows: &[(&str, f64, f64)]| {
            rows.iter()
                .map(|(key, matches, wins)| {
                    ((*key).to_string(), Totals { matches: *matches, wins: *wins })
                })
                .collect()
        };
        Split { current: table(current), previous: table(previous) }
    }

    fn contest(bans: &[(&str, f64)], games: f64) -> Contest {
        Contest {
            current_bans: bans.iter().map(|(k, v)| ((*k).to_string(), *v)).collect(),
            current_games: games,
            ..Contest::default()
        }
    }

    #[test]
    fn presence_is_the_share_of_games_a_champion_is_picked_or_banned_in() {
        let contest = contest(&[("ogre", 20.0)], 1000.0);
        // 100 picks + 20 bans out of 1000 games.
        assert!((contest.presence("ogre", 100.0, 0.0, 0.0) - 0.12).abs() < 1e-9);
        // Never touched at all.
        assert_eq!(contest.presence("ghost", 0.0, 0.0, 0.0), 0.0);
    }

    #[test]
    fn a_champion_banned_every_game_reads_as_fully_contested() {
        let contest = contest(&[("ogre", 1000.0)], 1000.0);
        // Banned out, so almost never picked - presence must still be high.
        assert_eq!(contest.presence("ogre", 0.0, 0.0, 0.0), 1.0);
    }

    #[test]
    fn presence_blends_the_previous_patch_on_the_same_fade() {
        let contest = Contest {
            current_bans: [("ogre".to_string(), 0.0)].into(),
            previous_bans: [("ogre".to_string(), 100.0)].into(),
            current_games: 100.0,
            previous_games: 100.0,
        };
        // Half-faded previous patch: (0 + 0*.5 picks + 0 + 100*.5 bans) / 150.
        let presence = contest.presence("ogre", 0.0, 0.0, 0.5);
        assert!((presence - (50.0 / 150.0)).abs() < 1e-9, "got {presence}");
    }

    #[test]
    fn with_no_games_to_measure_against_presence_gates_nothing() {
        // A save whose replays have not been scanned yet must not have every
        // champion struck off for zero presence.
        assert_eq!(Contest::default().presence("ogre", 0.0, 0.0, 0.0), 1.0);
    }

    #[test]
    fn a_champion_new_to_the_data_appears_on_its_first_games() {
        // Roster growth needs no configuration: champions come from whatever
        // the match records name.
        let competition = split(&[("brand_new", 40.0, 24.0)], &[]);
        let blended = blend(&competition, &Split::default(), &open_contest(), &params(0.8, 0.5));
        assert!(blended.contains_key("brand_new"));
    }

    #[test]
    fn a_well_covered_champion_barely_uses_the_previous_patch() {
        let competition = split(&[("ogre", 800.0, 480.0)], &[("ogre", 400.0, 100.0)]);
        let blended = blend(&competition, &Split::default(), &open_contest(), &params(0.8, 0.0));
        let ogre = totals_of(&blended, "ogre");
        // The old 25% record must not drag a 60% current record down much.
        assert!(ogre.wins / ogre.matches > 0.57, "win rate came out {}", ogre.wins / ogre.matches);
        assert!(ogre.matches < 830.0, "previous patch contributed {} games", ogre.matches - 800.0);
    }

    #[test]
    fn a_champion_with_no_games_this_patch_leans_on_the_last_one() {
        let competition = split(&[("ogre", 1.0, 1.0)], &[("ogre", 400.0, 100.0)]);
        let blended = blend(&competition, &Split::default(), &open_contest(), &params(0.8, 0.0));
        let ogre = totals_of(&blended, "ogre");
        assert!(ogre.matches > 250.0, "previous patch only gave {} games", ogre.matches);
        // And it inherits roughly the old rate rather than the single game.
        assert!(ogre.wins / ogre.matches < 0.35);
    }

    #[test]
    fn patches_older_than_the_previous_one_are_ignored_entirely() {
        let mut buckets: BTreeMap<String, BTreeMap<String, Totals>> = BTreeMap::new();
        for (version, matches) in [("2025.0.0", 900.0), ("2026.0.0", 400.0), ("2027.0.0", 800.0)] {
            buckets.insert(
                version.to_string(),
                [("ogre".to_string(), Totals { matches, wins: matches / 2.0 })].into(),
            );
        }
        let patches = Patches::identify(buckets.keys().cloned());
        let selected = select(&buckets, &patches);
        assert_eq!(selected.current["ogre"].matches, 800.0);
        assert_eq!(selected.previous["ogre"].matches, 400.0);
        // 2025 is present in the data and must not appear anywhere.
        assert_eq!(selected.current.len() + selected.previous.len(), 2);
    }

    #[test]
    fn a_hard_cut_drops_the_previous_patch_outright() {
        let competition = split(&[("ogre", 4.0, 4.0)], &[("ogre", 900.0, 200.0)]);
        let blended = blend(&competition, &Split::default(), &open_contest(), &params(0.0, 0.0));
        assert_eq!(totals_of(&blended, "ogre"), Totals { matches: 4.0, wins: 4.0 });
    }

    #[test]
    fn solo_games_join_at_their_configured_weight() {
        let competition = split(&[("ogre", 100.0, 50.0)], &[]);
        let solo = split(&[("ogre", 40.0, 40.0)], &[]);
        let blended = blend(&competition, &solo, &open_contest(), &params(0.8, 0.5));
        assert_eq!(totals_of(&blended, "ogre"), Totals { matches: 120.0, wins: 70.0 });
    }

    #[test]
    fn a_champion_seen_only_in_solo_still_appears() {
        let solo = split(&[("chef", 20.0, 12.0)], &[]);
        let blended = blend(&Split::default(), &solo, &open_contest(), &params(0.8, 0.5));
        assert_eq!(totals_of(&blended, "chef"), Totals { matches: 10.0, wins: 6.0 });
    }

    #[test]
    fn the_unversioned_path_counts_every_patch_equally() {
        let mut buckets: BTreeMap<String, BTreeMap<String, Totals>> = BTreeMap::new();
        for version in ["2025.0.0", "2026.0.0", "2027.0.0"] {
            buckets.insert(
                version.to_string(),
                [("ogre".to_string(), Totals { matches: 10.0, wins: 5.0 })].into(),
            );
        }
        let flat = flatten(&buckets);
        assert_eq!(flat.current["ogre"], Totals { matches: 30.0, wins: 15.0 });
        assert!(flat.previous.is_empty());
    }

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
