//! `config.ini` loading and hot reload.
//!
//! The file sits next to the mod binary. It is re-read whenever its mtime
//! changes, so edits take effect within one management tick without a
//! restart. A missing file is written out with the defaults and comments, so
//! the first launch documents itself.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::schema::Unrated;
use crate::stats::Source;
use crate::tiers::{Mode, Model, Shares, Thresholds};

#[derive(Clone, Debug)]
pub struct Config {
    /// Master switch.
    pub enabled: bool,
    /// Write tiers to the player's own team.
    pub tier_assign: bool,
    /// Also write them to every other team. Off by default: sharing one
    /// optimal tier list with the AI is what makes every draft look the same.
    pub apply_to_ai_teams: bool,
    pub mode: Mode,
    pub model: Model,
    pub shares: Shares,
    pub thresholds: Thresholds,
    /// Weight of solo-rank games relative to competition games.
    pub solo_weight: f64,
    /// Where competition win rates come from.
    pub source: Source,
    /// Maximum weight the previous balance patch can carry; faded per
    /// champion by how well the current patch is covered.
    pub prev_weight: f64,
    /// Match records read per pass while the first scan catches up.
    pub scan_budget: usize,
    /// Explicit path to the tier field, bypassing the search. Empty = search.
    pub tier_path: String,
    /// What to do with champions the stats cannot rate.
    pub unrated: Unrated,
    /// Minimum management ticks between recomputes.
    pub recompute_interval: u64,
    /// Write the schema dump and the tier table next to the mod.
    pub dump: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: true,
            tier_assign: true,
            apply_to_ai_teams: false,
            mode: Mode::Percentile,
            model: Model::default(),
            shares: Shares::default(),
            thresholds: Thresholds::default(),
            solo_weight: 0.5,
            source: Source::Replay,
            prev_weight: 0.8,
            scan_budget: 1000,
            tier_path: String::new(),
            unrated: Unrated::Keep,
            recompute_interval: 4,
            dump: true,
        }
    }
}

/// Tracks the file so a reload only happens when it actually changed.
pub struct ConfigFile {
    path: PathBuf,
    last_modified: Option<SystemTime>,
    current: Config,
}

impl ConfigFile {
    pub fn open(dir: &Path) -> Self {
        let path = dir.join("config.ini");
        if !path.exists() {
            let _ = std::fs::write(&path, DEFAULT_INI);
        }
        let mut file = Self { path, last_modified: None, current: Config::default() };
        file.reload();
        file
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn get(&self) -> &Config {
        &self.current
    }

    /// Re-reads the file when its mtime moved. Returns true on a reload.
    pub fn reload_if_changed(&mut self) -> bool {
        let modified = std::fs::metadata(&self.path).and_then(|meta| meta.modified()).ok();
        if modified == self.last_modified {
            return false;
        }
        self.last_modified = modified;
        self.reload();
        true
    }

    fn reload(&mut self) {
        self.last_modified =
            std::fs::metadata(&self.path).and_then(|meta| meta.modified()).ok();
        let Ok(text) = std::fs::read_to_string(&self.path) else {
            self.current = Config::default();
            return;
        };
        self.current = parse(&text);
    }
}

/// Parses the ini text. Unknown keys are ignored and an unparsable value
/// keeps the default, so a typo degrades one setting instead of the mod.
pub fn parse(text: &str) -> Config {
    let mut config = Config::default();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') || line.starts_with('[')
        {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else { continue };
        let key = key.trim().to_ascii_lowercase();
        // Trailing `# comment` on a value line is common in hand-edited inis.
        let value = value.split('#').next().unwrap_or("").trim();

        match key.as_str() {
            "enabled" => set_bool(&mut config.enabled, value),
            "tier_assign" => set_bool(&mut config.tier_assign, value),
            "apply_to_ai_teams" => set_bool(&mut config.apply_to_ai_teams, value),
            "mode" => {
                config.mode = match value.to_ascii_lowercase().as_str() {
                    "threshold" => Mode::Threshold,
                    "percentile" => Mode::Percentile,
                    _ => config.mode,
                }
            }
            "neutral" => set_f64(&mut config.model.neutral, value),
            "prior" => set_f64(&mut config.model.prior, value),
            "confidence_k" => set_f64(&mut config.model.confidence_k, value),
            "min_matches" => set_f64(&mut config.model.min_matches, value),
            "min_presence" => set_f64(&mut config.model.min_presence, value),
            "share_s" => set_f64(&mut config.shares.s, value),
            "share_a" => set_f64(&mut config.shares.a, value),
            "share_b" => set_f64(&mut config.shares.b, value),
            "share_c" => set_f64(&mut config.shares.c, value),
            "tier_s" => set_f64(&mut config.thresholds.s, value),
            "tier_a" => set_f64(&mut config.thresholds.a, value),
            "tier_b" => set_f64(&mut config.thresholds.b, value),
            "tier_c" => set_f64(&mut config.thresholds.c, value),
            "solo_weight" => set_f64(&mut config.solo_weight, value),
            "prev_weight" => set_f64(&mut config.prev_weight, value),
            "source" => {
                config.source = match value.to_ascii_lowercase().as_str() {
                    "replay" => Source::Replay,
                    "summary" => Source::Summary,
                    _ => config.source,
                }
            }
            "scan_budget" => {
                if let Ok(parsed) = value.parse::<usize>() {
                    config.scan_budget = parsed;
                }
            }
            "tier_path" => config.tier_path = value.to_string(),
            "unrated" => {
                config.unrated = match value.to_ascii_lowercase().as_str() {
                    "omit" => Unrated::Omit,
                    "keep" => Unrated::Keep,
                    _ => config.unrated,
                }
            }
            "recompute_interval" => {
                if let Ok(parsed) = value.parse::<u64>() {
                    config.recompute_interval = parsed.max(1);
                }
            }
            "dump" => set_bool(&mut config.dump, value),
            _ => {}
        }
    }
    config
}

fn set_bool(slot: &mut bool, value: &str) {
    match value.to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => *slot = true,
        "false" | "0" | "no" | "off" => *slot = false,
        _ => {}
    }
}

fn set_f64(slot: &mut f64, value: &str) {
    if let Ok(parsed) = value.parse::<f64>() {
        if parsed.is_finite() {
            *slot = parsed;
        }
    }
}

pub const DEFAULT_INI: &str = r#"# ============================================================================
# Win-Rate Champion Tiers - config
# Saved changes are hot-reloaded within a few seconds (no game restart needed).
# ============================================================================
# This mod does ONE thing: build an S/A/B/C/D champion tier list from win-rate
# statistics and write it to your own team. It does not touch the draft AI's
# scoring and it does not override any UI screen, so it can run alongside a
# separate ban/pick mod.

enabled=true

# tier_assign : write the computed tier list to your team.
tier_assign=true

# apply_to_ai_teams : also write the same list to every AI team.
#   Leave this false. When every team drafts off one shared "optimal" tier
#   list, the whole league bans and picks the same champions and the draft
#   stops being interesting. false = the AI keeps its own vanilla tiers.
apply_to_ai_teams=false

# ---------------------------------------------------------------------------
# Tier shape
# ---------------------------------------------------------------------------
# mode=percentile : rank the roster by the metric and hand out tiers by share.
#                   The distribution is what you configure below.
# mode=threshold  : compare the metric against fixed cut-offs (tier_s..tier_c).
#                   Simpler, but because the metric pulls thin samples toward
#                   `neutral`, most of the roster lands in whichever band
#                   straddles it - this is why plain thresholds give you a
#                   huge B tier.
mode=percentile

# Share of the *rated* roster per tier (champions under min_matches are left
# out of both the tiers and the budget). D takes whatever is left over.
# These four only have to stay under 1.0.
#   Defaults below: S 10% / A 20% / B 30% / C 25% / D 15%.
# Want even fewer B and more C/D? Try share_b=0.24, share_c=0.28.
share_s=0.10
share_a=0.20
share_b=0.30
share_c=0.25

# Absolute cut-offs, used only when mode=threshold.
tier_s=0.55
tier_a=0.52
tier_b=0.50
tier_c=0.478

# ---------------------------------------------------------------------------
# Win-rate model
# ---------------------------------------------------------------------------
#   wr     = (wins + prior*neutral) / (matches + prior)   # Bayesian shrink
#   conf   = m / (m + confidence_k)                       # 0..1
#   metric = neutral + (wr - neutral) * conf
# neutral      : break-even win rate; the shrink centre and metric midpoint.
# prior        : prior strength, in virtual games played at `neutral`.
# confidence_k : higher = stronger shrink for low samples.
# min_matches  : below this many effective games a champion gets No Tier.
# min_presence : share of competition games in which a champion must be picked
#                OR BANNED to be tiered at all. 0.05 = contested in 5% of games.
#                For scale: a game seats 10 picks and 4 bans across ~57
#                champions, so a champion drafted at random would sit near 24%.
#                0.05 therefore means "at least a fifth as contested as an
#                average champion" - raise it to demand real meta presence.
#                Win rate alone rewards a champion nobody contests - a thin
#                sample taken only in favourable drafts reads as strength, which
#                is how a champion the league never picks ends up S tier. Bans
#                count, so a champion strong enough to be banned out is not
#                punished for the low pick count that causes.
#                0 disables the gate. Solo-rank games never count toward it:
#                the point is what the competition scene actually contests.
# solo_weight  : weight of solo-rank games against competition games.
#                effective games = competition + solo_weight * solo.
#                0 = competition only.
neutral=0.5
prior=10
confidence_k=50
min_matches=5
min_presence=0.05
solo_weight=0.5

# ---------------------------------------------------------------------------
# Balance patches
# ---------------------------------------------------------------------------
# Match records carry a `version` string naming the balance patch they were
# played under. Only the newest two patches are ever counted; anything older
# is ignored outright, so a long career does not drag years-old balance into
# today's tier list.
#
#   effective m,w = current patch + pf * previous patch
#   pf = (1 - conf(current games)) * prev_weight * conf(previous games)
#
# The (1 - conf(current)) term is the point: the previous patch only fills the
# gap the current one has not covered yet, and fades out on its own as games
# accumulate. It is computed PER CHAMPION, so a champion picked a lot this
# patch stops leaning on old data long before a rarely-picked one does.
#
# prev_weight : the most the previous patch can ever be worth.
#               0.8 (default) settles into "latest patch only" once the patch
#               has been played, without the tier list turning to noise in the
#               days right after it lands.
#               0   = a hard cut: current patch only, from the first game.
prev_weight=0.8

# source : where competition win rates come from.
#   replay  (default) - one record per game, carrying the balance patch. This
#           is the only source that can split competition history by patch, so
#           prev_weight does nothing without it. Costs one scan of the replay
#           table on first use, spread over several ticks.
#   summary - the champion_detail aggregates on the competition records.
#           Cheap and instant, but they carry NO patch information, so every
#           game counts equally no matter how old.
source=replay

# scan_budget : match records read per pass while the first scan catches up.
#               Lower if the game stutters on a new save, 0 to lift the limit
#               and take the whole scan in one tick.
scan_budget=1000

# ---------------------------------------------------------------------------
# Where the tier list is written
# ---------------------------------------------------------------------------
# tier_path : dot path to the tier field inside the team document. Leave empty
#             to search for it. On a current save the field is:
#                 champion_tiers = { "amazon": "B", "archer": "C", ... }
#             held per team, which is what lets this mod write yours without
#             touching the rest of the league.
tier_path=

# unrated : what to do with a champion that has fewer than min_matches games.
#   keep = leave whatever tier the save already has (default). The live schema
#          has no "no tier" value - every champion carries one of S/A/B/C/D -
#          so keeping one is the option that stays in a shape the game accepts.
#   omit = drop the champion from the list entirely.
unrated=keep

# ---------------------------------------------------------------------------
# Housekeeping
# ---------------------------------------------------------------------------
# recompute_interval : minimum management ticks between recomputes.
# dump : write tier_table.txt (and schema_dump.txt on first run) next to the
#        mod. Useful for checking what the mod actually sees.
recompute_interval=4
dump=true
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shipped_default_ini_parses_to_the_defaults() {
        let parsed = parse(DEFAULT_INI);
        let defaults = Config::default();
        assert_eq!(parsed.enabled, defaults.enabled);
        assert_eq!(parsed.apply_to_ai_teams, false);
        assert_eq!(parsed.mode, Mode::Percentile);
        assert_eq!(parsed.shares.s, defaults.shares.s);
        assert_eq!(parsed.shares.b, defaults.shares.b);
        assert_eq!(parsed.model.confidence_k, defaults.model.confidence_k);
        assert_eq!(parsed.solo_weight, defaults.solo_weight);
    }

    #[test]
    fn reads_overrides_and_ignores_comments() {
        let config = parse(
            "# leading comment\n\
             [section]\n\
             share_b = 0.24   # fewer B\n\
             mode=threshold\n\
             apply_to_ai_teams = yes\n\
             unknown_key=1\n",
        );
        assert_eq!(config.shares.b, 0.24);
        assert_eq!(config.mode, Mode::Threshold);
        assert!(config.apply_to_ai_teams);
    }

    #[test]
    fn a_bad_value_keeps_that_one_default() {
        let config = parse("share_b=not-a-number\nshare_c=0.28\nneutral=NaN\n");
        assert_eq!(config.shares.b, Shares::default().b);
        assert_eq!(config.shares.c, 0.28);
        assert_eq!(config.model.neutral, 0.5);
    }

    #[test]
    fn recompute_interval_never_reaches_zero() {
        assert_eq!(parse("recompute_interval=0").recompute_interval, 1);
    }
}
