//! Balance-patch identity and the previous-patch fade.
//!
//! Match documents carry a `version` string like `"2027.0.0"` naming the
//! balance patch they were played under. The competition *aggregates* do not,
//! which is why patch weighting needs the per-match records: only they can
//! say which patch a game belongs to.
//!
//! The blend is the one the original `draft_winrate_penalty` mod documented:
//!
//! ```text
//! effective m,w = current patch + pf * previous patch   (one patch back only)
//! pf = (1 - conf(mc)) * prev_weight * conf(mp)
//! ```
//!
//! The `(1 - conf(mc))` term is what makes it work. The previous patch only
//! fills the gap the current patch has not covered yet, and fades out on its
//! own as games accumulate — per champion, not league-wide, so a champion
//! that is being picked a lot this patch stops leaning on old data long
//! before a rarely-picked one does. It reaches "latest patch only" by
//! itself, without a threshold to tune or a cliff to fall off.

/// Orders versions newest-first. Unparsable components sort low rather than
/// failing, so an unexpected format degrades to "oldest" instead of
/// reordering everything.
pub fn parse_version(version: &str) -> (u64, u64, u64) {
    let mut parts = version.split('.').map(|part| part.trim().parse::<u64>().unwrap_or(0));
    (parts.next().unwrap_or(0), parts.next().unwrap_or(0), parts.next().unwrap_or(0))
}

/// The two patches that count: everything older is ignored outright, which
/// is what the original mod did and what keeps a long career from dragging
/// years-old balance into today's tier list.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Patches {
    pub current: Option<String>,
    pub previous: Option<String>,
}

impl Patches {
    /// Picks the newest two versions present.
    pub fn identify(versions: impl IntoIterator<Item = String>) -> Self {
        let mut ordered: Vec<String> = versions.into_iter().collect();
        ordered.sort_by(|left, right| {
            parse_version(right).cmp(&parse_version(left)).then(right.cmp(left))
        });
        ordered.dedup();
        let mut iter = ordered.into_iter();
        Self { current: iter.next(), previous: iter.next() }
    }

    pub fn describe(&self) -> String {
        match (&self.current, &self.previous) {
            (Some(current), Some(previous)) => format!("{current} (prev {previous})"),
            (Some(current), None) => current.clone(),
            _ => "none".to_string(),
        }
    }
}

/// Weight the previous patch carries for one champion.
///
/// `cur_matches` / `prev_matches` are that champion's game counts in each
/// patch; `k` is the same confidence factor the tier metric uses.
pub fn previous_fade(cur_matches: f64, prev_matches: f64, prev_weight: f64, k: f64) -> f64 {
    if prev_weight <= 0.0 || prev_matches <= 0.0 || k <= 0.0 {
        return 0.0;
    }
    let confidence = |matches: f64| matches / (matches + k);
    (1.0 - confidence(cur_matches.max(0.0))) * prev_weight * confidence(prev_matches)
}

#[cfg(test)]
mod tests {
    use super::*;

    const K: f64 = 50.0;

    fn versions(list: &[&str]) -> Vec<String> {
        list.iter().map(|version| (*version).to_string()).collect()
    }

    #[test]
    fn identifies_the_newest_two_patches() {
        let patches = Patches::identify(versions(&["2026.0.0", "2027.0.0", "2025.3.1"]));
        assert_eq!(patches.current.as_deref(), Some("2027.0.0"));
        assert_eq!(patches.previous.as_deref(), Some("2026.0.0"));
    }

    #[test]
    fn version_components_order_numerically_not_lexically() {
        let patches = Patches::identify(versions(&["2026.9.0", "2026.10.0"]));
        assert_eq!(patches.current.as_deref(), Some("2026.10.0"));
    }

    #[test]
    fn a_single_patch_leaves_no_previous() {
        let patches = Patches::identify(versions(&["2027.0.0", "2027.0.0"]));
        assert_eq!(patches.current.as_deref(), Some("2027.0.0"));
        assert_eq!(patches.previous, None);
    }

    #[test]
    fn the_previous_patch_carries_the_new_patch_until_it_stands_up() {
        // Right after a patch lands the champion has almost no games, so the
        // previous patch does most of the work.
        let fresh = previous_fade(2.0, 400.0, 0.8, K);
        assert!(fresh > 0.6, "fade right after a patch was only {fresh}");

        // Once it has been played a lot, the old patch is essentially gone.
        let settled = previous_fade(800.0, 400.0, 0.8, K);
        assert!(settled < 0.06, "fade after a full patch was still {settled}");
        assert!(settled < fresh);
    }

    #[test]
    fn the_fade_is_per_champion() {
        // Same patch, same history: the popular champion drops the old data
        // while the rare one still leans on it.
        let popular = previous_fade(300.0, 300.0, 0.8, K);
        let rare = previous_fade(4.0, 300.0, 0.8, K);
        assert!(rare > popular * 5.0, "rare {rare} vs popular {popular}");
    }

    #[test]
    fn a_thin_previous_patch_is_trusted_less() {
        let thick_prev = previous_fade(5.0, 500.0, 0.8, K);
        let thin_prev = previous_fade(5.0, 5.0, 0.8, K);
        assert!(thin_prev < thick_prev / 5.0);
    }

    #[test]
    fn zero_prev_weight_is_a_hard_cut_to_the_current_patch() {
        assert_eq!(previous_fade(1.0, 10_000.0, 0.0, K), 0.0);
    }

    #[test]
    fn missing_previous_data_contributes_nothing() {
        assert_eq!(previous_fade(100.0, 0.0, 0.8, K), 0.0);
    }
}
