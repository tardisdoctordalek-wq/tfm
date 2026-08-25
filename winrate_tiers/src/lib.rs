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
//!
//! Win rates come from `statistics.<athlete>.champion_detail` on the
//! competition records and from the per-match `SoloRankMatch` documents; the
//! list is written to `champion_tiers` on the team record. See `stats.rs` and
//! `schema.rs` for how those are read and located.

pub mod config;
pub mod json;
pub mod log;
pub mod modpath;
pub mod probe;
pub mod schema;
pub mod stats;
pub mod tiers;

use std::fmt::Write as _;
use std::path::PathBuf;
use std::sync::Mutex;

use mod_api_stable::{
    declare_stable_mod, LogLevel, RecordKindV1, StableHost, StableMod, StableServerCtx,
    StableServerExtension,
};

pub const MOD_ID: &str = "winrate_tiers";

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
    stats: stats::Collector,
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
                stats: stats::Collector::default(),
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
        // A different save has different records; nothing carries over.
        state.stats = stats::Collector::default();

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
        let (records, summary) = state.stats.collect(ctx, config.solo_weight);
        if records.is_empty() {
            log::line(
                "no champion win/loss data found - a fresh save has none until \
                 competitions have been played",
            );
            return;
        }

        let assignments = tiers::classify(
            &records,
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

        let pinned = (!config.tier_path.is_empty()).then_some(config.tier_path.as_str());
        let mut written = 0usize;
        let mut sink_path = String::new();
        // Tracked separately so the log can say which step failed: not
        // finding the field and having the write rejected need different
        // fixes, and one shared message cannot tell them apart.
        let mut sinks_found = 0usize;
        let mut rejected = 0usize;
        let mut unverified = 0usize;

        for team_id in targets {
            let Some(doc) = ctx.team_get_json(team_id, "").as_deref().and_then(json::Value::parse)
            else {
                continue;
            };
            let Some(sink) = schema::find_tier_sink(&doc, pinned) else { continue };
            sinks_found += 1;
            sink_path = sink.path.clone();
            let payload = schema::encode_assignment(
                sink.shape,
                &assignments,
                doc.path(&sink.path),
                config.unrated,
            );
            if !ctx.team_set_json(team_id, &sink.path, &payload) {
                rejected += 1;
                continue;
            }
            // The write is the whole point of the mod, and `team_set_json`
            // reporting success is not proof the document kept it. Read it
            // back once rather than trusting the return value.
            let stored = ctx.team_get_json(team_id, &sink.path);
            if stored.as_deref().and_then(json::Value::parse)
                != json::Value::parse(&payload)
            {
                unverified += 1;
                continue;
            }
            written += 1;
        }

        if written == 0 {
            if sinks_found == 0 {
                log::line(
                    "no champion-tier field found on the team record - see the \
                     TIER-FIELD CANDIDATES section of schema_dump.txt, then set \
                     tier_path in config.ini",
                );
            } else if rejected > 0 {
                log::line(&format!(
                    "the game rejected the write at '{sink_path}' on {rejected} team(s) - \
                     the field was found, so the payload shape is what to look at"
                ));
            } else {
                log::line(&format!(
                    "wrote '{sink_path}' on {unverified} team(s) but reading it back did \
                     not match - the game is overwriting or reshaping the value"
                ));
            }
            return;
        }
        if rejected > 0 || unverified > 0 {
            log::line(&format!(
                "note: {rejected} write(s) rejected and {unverified} did not verify at '{sink_path}'"
            ));
        }

        state.last_written = Some(fingerprint);
        let counts = tiers::histogram(&assignments)
            .iter()
            .map(|(tier, count)| format!("{tier}:{count}"))
            .collect::<Vec<_>>()
            .join(" ");
        log::line(&format!(
            "wrote {} champions to '{sink_path}' on {written} team(s) [{counts}] \
             (competition {:.0} games, solo {:.0}, +{} new solo records)",
            summary.champions,
            summary.competition_matches,
            summary.solo_matches,
            summary.new_solo_records
        ));

        if config.dump {
            if let Some(dir) = state.dir.as_ref() {
                let _ = std::fs::write(
                    dir.join("tier_table.txt"),
                    render_table(&assignments, &summary, config),
                );
            }
        }
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
    summary: &stats::Summary,
    config: &config::Config,
) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "# {MOD_ID} - champion tier table");
    let _ = writeln!(
        out,
        "# games: competition {:.0}, solo {:.0} (weighted x{})",
        summary.competition_matches, summary.solo_matches, config.solo_weight
    );
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
        let text = render_table(&list, &stats::Summary::default(), &config::Config::default());
        assert!(text.contains("S=1"));
        assert!(text.contains("D=1"));
        assert!(text.contains("fighter"));
    }
}
