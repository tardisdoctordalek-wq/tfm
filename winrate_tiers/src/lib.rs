//! Win-Rate Champion Tiers.
//!
//! Builds an S/A/B/C/D champion tier list from in-game win-rate statistics
//! and writes it to the player's own team.
//!
//! Two things set it apart from the mod it grew out of:
//!
//! * Tiers are handed out by **share of the ranked roster**, not by absolute
//!   win-rate cut-offs. The metric shrinks thin samples toward the break-even
//!   rate, so fixed cut-offs dump most of the roster into the band that
//!   straddles it — which is why a plain threshold build ends up almost all B.
//! * The list goes to **your team only**. Writing one "solved" tier list to
//!   every AI team makes the whole league ban and pick the same champions.
//!   `apply_to_ai_teams` turns that back on for anyone who wants it.
//!
//! It registers a server extension and nothing else: no draft-score hook and
//! no UI override, so it composes with a separate ban/pick or tier-list mod
//! instead of fighting it for the champion screen.

mod config;
mod json;
mod log;
mod modpath;
mod probe;
mod schema;
mod tiers;

use std::fmt::Write as _;
use std::path::PathBuf;
use std::sync::Mutex;

use mod_api_stable::{
    declare_stable_mod, LogLevel, RecordKindV1, StableHost, StableMod, StableServerCtx,
    StableServerExtension,
};

pub const MOD_ID: &str = "winrate_tiers";

/// Record kinds searched for a per-champion win/loss table, most specific
/// first. The first kind that yields a table wins.
const STAT_KINDS: [RecordKindV1; 4] = [
    RecordKindV1::KnowledgeBase,
    RecordKindV1::League,
    RecordKindV1::LeagueCompetition,
    RecordKindV1::SoloRankMatch,
];

fn init(host: &StableHost) -> StableMod {
    let version = host.game_version();
    host.log(
        LogLevel::Info,
        &format!(
            "{MOD_ID} loaded (game {}.{}.{}, abi {})",
            version.major, version.minor, version.patch, host.abi_level()
        ),
    );

    let mut decl = StableMod::new(MOD_ID);
    decl.set_server_extension(TierExtension::new());
    decl
}

declare_stable_mod!(init);

/// Everything that survives between hook calls. The trait is `&self`, so the
/// mutable part lives behind a mutex.
struct TierExtension {
    state: Mutex<State>,
}

struct State {
    dir: Option<PathBuf>,
    config: Option<config::ConfigFile>,
    ticks: u64,
    probed: bool,
    /// Fingerprint of the last list written, so an unchanged recompute does
    /// not rewrite the record every tick.
    last_written: Option<u64>,
}

impl TierExtension {
    fn new() -> Self {
        Self {
            state: Mutex::new(State {
                dir: None,
                config: None,
                ticks: 0,
                probed: false,
                last_written: None,
            }),
        }
    }

}

impl StableServerExtension for TierExtension {
    fn on_server_start(&self, ctx: &mut StableServerCtx<'_>) {
        let Ok(mut state) = self.state.lock() else { return };
        state.ticks = 0;
        state.probed = false;
        state.last_written = None;

        if state.dir.is_none() {
            state.dir = modpath::mod_dir();
        }
        match state.dir.clone() {
            Some(dir) => {
                log::open(&dir);
                log::line(&format!("config directory: {}", dir.display()));
                state.config = Some(config::ConfigFile::open(&dir));
            }
            None => {
                log::line("could not locate the mod directory; running on defaults with no config.ini");
            }
        }

        // The probe reads the live save, so it runs here rather than at load.
        let dump = state.config.as_ref().is_none_or(|file| file.get().dump);
        if let (Some(dir), true) = (state.dir.clone(), dump) {
            let team = player_team(ctx);
            match probe::write_report(ctx, &dir, team) {
                Some(()) => log::line(&format!("wrote {}", dir.join("schema_dump.txt").display())),
                None => log::line("could not write schema_dump.txt"),
            }
            state.probed = true;
        }
    }

    fn after_management_tick(&self, ctx: &mut StableServerCtx<'_>) {
        let Ok(mut state) = self.state.lock() else { return };
        state.ticks += 1;

        if let Some(file) = state.config.as_mut() {
            if file.reload_if_changed() {
                let path = file.path().display().to_string();
                // A reload may have changed the shape; let the next pass write.
                state.last_written = None;
                log::line(&format!("reloaded {path}"));
            }
        }

        let config = state.config.as_ref().map_or_else(config::Config::default, |file| file.get().clone());
        if !config.enabled || !config.tier_assign {
            return;
        }
        if state.ticks % config.recompute_interval != 0 {
            return;
        }

        self.recompute(ctx, &mut state, &config);
    }
}

impl TierExtension {
    fn recompute(&self, ctx: &mut StableServerCtx<'_>, state: &mut State, config: &config::Config) {
        let Some(table) = self.collect_stats(ctx) else {
            log::line(
                "no per-champion win/loss table found in any record kind - \
                 check schema_dump.txt and pin the path in config.ini",
            );
            return;
        };

        let assignments = tiers::classify(
            &table.rows,
            &config.model,
            config.mode,
            &config.shares,
            &config.thresholds,
        );

        let fingerprint = fingerprint(&assignments);
        if state.last_written == Some(fingerprint) {
            return;
        }

        let Some(player) = player_team(ctx) else {
            log::line("could not resolve the player's team id; nothing written");
            return;
        };

        // Only the player's team, unless the config explicitly opts in.
        let mut targets = vec![player];
        if config.apply_to_ai_teams {
            targets.extend(ctx.record_ids(RecordKindV1::Team).into_iter().filter(|id| *id != player));
        }

        let mut written = 0usize;
        let mut sink_path = String::new();
        for team_id in targets {
            let Some(doc) = ctx.team_get_json(team_id, "").as_deref().and_then(json::Value::parse)
            else {
                continue;
            };
            let Some(sink) = schema::find_tier_sink(&doc, None) else { continue };
            let payload = schema::encode_assignment(sink.shape, &assignments);
            if ctx.team_set_json(team_id, &sink.path, &payload) {
                written += 1;
                sink_path = sink.path;
            }
        }

        if written == 0 {
            log::line(
                "found no writable champion-tier field on the team record - \
                 see the TIER-FIELD CANDIDATES section of schema_dump.txt",
            );
            return;
        }

        state.last_written = Some(fingerprint);
        let counts = tiers::histogram(&assignments)
            .iter()
            .map(|(tier, count)| format!("{tier}:{count}"))
            .collect::<Vec<_>>()
            .join(" ");
        log::line(&format!(
            "tiers applied to {written} team(s) via '{sink_path}' from {} champions [{counts}]",
            table.rows.len()
        ));

        if config.dump {
            if let Some(dir) = state.dir.as_ref() {
                let _ = std::fs::write(
                    dir.join("tier_table.txt"),
                    render_table(&assignments, &table.path, config),
                );
            }
        }
    }

    /// Walks the record kinds looking for a champion win/loss table.
    fn collect_stats(&self, ctx: &StableServerCtx<'_>) -> Option<schema::StatTable> {
        for kind in STAT_KINDS {
            for id in ctx.record_ids(kind).into_iter().take(4) {
                let Some(doc) = ctx.record_get_json(kind, id, "").as_deref().and_then(json::Value::parse)
                else {
                    continue;
                };
                if let Some(table) = schema::find_stat_table(&doc, None) {
                    return Some(table);
                }
            }
        }
        None
    }
}

/// The player's team. In single player the human is player 0, but the id is
/// probed rather than assumed.
fn player_team(ctx: &StableServerCtx<'_>) -> Option<usize> {
    (0..8usize).find_map(|player_id| ctx.player_team_id(player_id))
}

/// Order-independent hash of the assignment, used to skip no-op rewrites.
fn fingerprint(assignments: &[tiers::Assignment]) -> u64 {
    let mut total: u64 = 0;
    for entry in assignments {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for byte in entry.key.as_bytes().iter().chain(entry.tier.label().as_bytes()) {
            hash ^= *byte as u64;
            hash = hash.wrapping_mul(0x1000_0000_01b3);
        }
        total = total.wrapping_add(hash);
    }
    total
}

fn render_table(
    assignments: &[tiers::Assignment],
    source: &str,
    config: &config::Config,
) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "# {MOD_ID} - champion tier table");
    let _ = writeln!(out, "# stat source: {source}");
    let _ = writeln!(
        out,
        "# mode: {:?}   neutral={} prior={} confidence_k={} min_matches={}",
        config.mode,
        config.model.neutral,
        config.model.prior,
        config.model.confidence_k,
        config.model.min_matches
    );
    let counts = tiers::histogram(assignments)
        .iter()
        .map(|(tier, count)| format!("{tier}={count}"))
        .collect::<Vec<_>>()
        .join("  ");
    let _ = writeln!(out, "# distribution: {counts}\n");
    let _ = writeln!(out, "{:<4} {:<28} {:>8} {:>10}", "tier", "champion", "games", "metric");
    for entry in assignments {
        let _ = writeln!(
            out,
            "{:<4} {:<28} {:>8.1} {:>10.4}",
            entry.tier.label(),
            entry.key,
            entry.matches,
            entry.metric
        );
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tiers::{Assignment, Tier};

    fn assignment(key: &str, tier: Tier) -> Assignment {
        Assignment { champion_id: 0, key: key.into(), tier, metric: 0.5, matches: 9.0 }
    }

    #[test]
    fn fingerprint_ignores_order_but_tracks_tier_changes() {
        let a = [assignment("x", Tier::S), assignment("y", Tier::C)];
        let reordered = [assignment("y", Tier::C), assignment("x", Tier::S)];
        let changed = [assignment("x", Tier::A), assignment("y", Tier::C)];
        assert_eq!(fingerprint(&a), fingerprint(&reordered));
        assert_ne!(fingerprint(&a), fingerprint(&changed));
    }

    #[test]
    fn rendered_table_reports_the_distribution() {
        let list = [assignment("fighter", Tier::S), assignment("mage", Tier::D)];
        let text = render_table(&list, "league.stats", &config::Config::default());
        assert!(text.contains("S=1"));
        assert!(text.contains("D=1"));
        assert!(text.contains("fighter"));
    }
}
