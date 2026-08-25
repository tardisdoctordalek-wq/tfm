//! Champion tier classification.
//!
//! Two modes. `Threshold` is the original mod's behaviour: compare the
//! confidence-adjusted win rate against fixed cut-offs. It has a structural
//! problem — the metric is `neutral + (wr - neutral) * conf`, which pulls
//! every thin-sample champion toward `neutral`, so most of the roster piles
//! into whichever band straddles it (in practice, B).
//!
//! `Percentile` fixes that by ranking the roster and handing out tiers by
//! share, so the shape of the distribution is a config value rather than an
//! accident of how tightly the metric clusters.

use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Tier {
    S,
    A,
    B,
    C,
    D,
    /// Not enough games to judge — left off the tier list entirely.
    None,
}

impl Tier {
    pub const RANKED: [Tier; 5] = [Tier::S, Tier::A, Tier::B, Tier::C, Tier::D];

    pub fn label(self) -> &'static str {
        match self {
            Tier::S => "S",
            Tier::A => "A",
            Tier::B => "B",
            Tier::C => "C",
            Tier::D => "D",
            Tier::None => "-",
        }
    }
}

impl fmt::Display for Tier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.label())
    }
}

/// One champion's aggregated record, already blended across patches and
/// across solo-rank/competition by the stats layer.
#[derive(Clone, Debug)]
pub struct ChampionRecord {
    pub champion_id: usize,
    pub key: String,
    /// Effective game count (competition + solo_weight * solo, previous
    /// patch already faded in).
    pub matches: f64,
    /// Effective wins on the same scale as `matches`.
    pub wins: f64,
    /// Share of competition games in which the champion was picked or banned,
    /// 0..1. Win rate alone rewards a champion nobody contests: a thin sample
    /// taken only in favourable drafts reads as strength. Presence is what
    /// separates that from a champion the league actually fights over, and
    /// counting bans keeps a champion that is strong enough to be banned out
    /// from being punished for a low pick count.
    pub presence: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct Model {
    /// Break-even win rate: the shrink centre and the metric's midpoint.
    pub neutral: f64,
    /// Bayesian prior strength, in virtual games played at `neutral`.
    pub prior: f64,
    /// Confidence factor K in `conf = m / (m + K)`.
    pub confidence_k: f64,
    /// Champions under this many effective games get no tier at all.
    pub min_matches: f64,
    /// Champions contested in a smaller share of competition games than this
    /// get no tier either, however good their win rate looks.
    pub min_presence: f64,
}

impl Default for Model {
    fn default() -> Self {
        Self {
            neutral: 0.5,
            prior: 10.0,
            confidence_k: 50.0,
            min_matches: 5.0,
            min_presence: 0.05,
        }
    }
}

impl Model {
    /// Confidence-adjusted win rate — the number both modes rank on.
    pub fn metric(&self, record: &ChampionRecord) -> f64 {
        if record.matches <= 0.0 {
            return self.neutral;
        }
        let shrunk =
            (record.wins + self.prior * self.neutral) / (record.matches + self.prior);
        let confidence = record.matches / (record.matches + self.confidence_k);
        self.neutral + (shrunk - self.neutral) * confidence
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Percentile,
    Threshold,
}

/// Share of the ranked roster each tier takes, in `Percentile` mode. D is
/// whatever is left over, so the four values only have to stay under 1.0.
#[derive(Clone, Copy, Debug)]
pub struct Shares {
    pub s: f64,
    pub a: f64,
    pub b: f64,
    pub c: f64,
}

impl Default for Shares {
    fn default() -> Self {
        // Deliberately smaller than the old effective B band, with the
        // difference handed to C and D.
        Self { s: 0.10, a: 0.20, b: 0.30, c: 0.25 }
    }
}

/// Absolute cut-offs, in `Threshold` mode. A champion lands in the highest
/// tier whose cut-off its metric clears.
#[derive(Clone, Copy, Debug)]
pub struct Thresholds {
    pub s: f64,
    pub a: f64,
    pub b: f64,
    pub c: f64,
}

impl Default for Thresholds {
    fn default() -> Self {
        Self { s: 0.55, a: 0.52, b: 0.50, c: 0.478 }
    }
}

#[derive(Clone, Debug)]
pub struct Assignment {
    pub champion_id: usize,
    pub key: String,
    pub tier: Tier,
    pub metric: f64,
    pub matches: f64,
    pub presence: f64,
}

/// Classifies the whole roster. Output is sorted by metric descending, then
/// by champion id, so a run over unchanged stats produces an identical list.
pub fn classify(
    records: &[ChampionRecord],
    model: &Model,
    mode: Mode,
    shares: &Shares,
    thresholds: &Thresholds,
) -> Vec<Assignment> {
    let mut scored: Vec<Assignment> = records
        .iter()
        .map(|record| Assignment {
            champion_id: record.champion_id,
            key: record.key.clone(),
            tier: Tier::None,
            metric: model.metric(record),
            matches: record.matches,
            presence: record.presence,
        })
        .collect();

    scored.sort_by(|left, right| {
        right
            .metric
            .partial_cmp(&left.metric)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(left.champion_id.cmp(&right.champion_id))
    });

    // Thin-sample and uncontested champions are ranked but never tiered, and
    // they must not consume percentile budget either — so split them out
    // first. Both gates are needed: `min_matches` catches too little data,
    // `min_presence` catches data the league does not back up.
    let (rated, unrated): (Vec<_>, Vec<_>) = scored.into_iter().partition(|entry| {
        entry.matches >= model.min_matches && entry.presence >= model.min_presence
    });

    let mut rated = rated;
    match mode {
        Mode::Threshold => {
            for entry in &mut rated {
                entry.tier = threshold_tier(entry.metric, thresholds);
            }
        }
        Mode::Percentile => assign_by_share(&mut rated, shares),
    }

    rated.into_iter().chain(unrated).collect()
}

fn threshold_tier(metric: f64, thresholds: &Thresholds) -> Tier {
    if metric >= thresholds.s {
        Tier::S
    } else if metric >= thresholds.a {
        Tier::A
    } else if metric >= thresholds.b {
        Tier::B
    } else if metric >= thresholds.c {
        Tier::C
    } else {
        Tier::D
    }
}

fn assign_by_share(rated: &mut [Assignment], shares: &Shares) {
    let total = rated.len();
    if total == 0 {
        return;
    }

    // Cumulative cut indices. Clamping keeps a share list that sums past 1.0
    // from handing later tiers a negative span.
    let raw = [shares.s, shares.a, shares.b, shares.c];
    let mut cuts = [0usize; 4];
    let mut running = 0.0f64;
    for (index, share) in raw.iter().enumerate() {
        running += share.max(0.0);
        cuts[index] = ((running.min(1.0) * total as f64).round() as usize).min(total);
        if index > 0 {
            cuts[index] = cuts[index].max(cuts[index - 1]);
        }
    }

    for (index, entry) in rated.iter_mut().enumerate() {
        entry.tier = match index {
            i if i < cuts[0] => Tier::S,
            i if i < cuts[1] => Tier::A,
            i if i < cuts[2] => Tier::B,
            i if i < cuts[3] => Tier::C,
            _ => Tier::D,
        };
    }

    // Champions with an identical metric must share a tier, or the list
    // reads as noise — the cut lands mid-tie only because of the id
    // tiebreak. Promote each tied run to the best tier in the run.
    let mut start = 0usize;
    while start < rated.len() {
        let mut end = start + 1;
        while end < rated.len() && (rated[end].metric - rated[start].metric).abs() < f64::EPSILON {
            end += 1;
        }
        if end - start > 1 {
            let best = rated[start..end].iter().map(|entry| entry.tier).min().unwrap_or(Tier::None);
            for entry in &mut rated[start..end] {
                entry.tier = best;
            }
        }
        start = end;
    }
}

/// Count per tier, for the log line and the dump header.
pub fn histogram(assignments: &[Assignment]) -> Vec<(Tier, usize)> {
    let mut counts = Vec::new();
    for tier in Tier::RANKED.iter().copied().chain(std::iter::once(Tier::None)) {
        counts.push((tier, assignments.iter().filter(|entry| entry.tier == tier).count()));
    }
    counts
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(id: usize, matches: f64, win_rate: f64) -> ChampionRecord {
        ChampionRecord {
            champion_id: id,
            key: format!("champ{id}"),
            matches,
            wins: matches * win_rate,
            // Contested enough to pass the presence gate unless a test says
            // otherwise.
            presence: 0.5,
        }
    }

    /// A roster whose win rates sit in a tight band around 50% — the shape
    /// that makes the threshold mode collapse into B.
    fn clustered_roster() -> Vec<ChampionRecord> {
        (0..100)
            .map(|i| record(i, 40.0, 0.44 + (i as f64) * 0.0012))
            .collect()
    }

    #[test]
    fn threshold_mode_piles_the_roster_into_one_band() {
        let assignments = classify(
            &clustered_roster(),
            &Model::default(),
            Mode::Threshold,
            &Shares::default(),
            // The original mod's shipped cut-offs.
            &Thresholds { s: 0.55, a: 0.52, b: 0.48, c: 0.45 },
        );
        let b_count = assignments.iter().filter(|entry| entry.tier == Tier::B).count();
        assert!(b_count > 90, "expected the B band to swallow the roster, got {b_count}");
    }

    #[test]
    fn percentile_mode_matches_the_configured_shape() {
        let shares = Shares { s: 0.10, a: 0.20, b: 0.30, c: 0.25 };
        let assignments =
            classify(&clustered_roster(), &Model::default(), Mode::Percentile, &shares, &Thresholds::default());
        let count = |tier: Tier| assignments.iter().filter(|entry| entry.tier == tier).count();
        assert_eq!(count(Tier::S), 10);
        assert_eq!(count(Tier::A), 20);
        assert_eq!(count(Tier::B), 30);
        assert_eq!(count(Tier::C), 25);
        assert_eq!(count(Tier::D), 15);
    }

    #[test]
    fn an_uncontested_champion_gets_no_tier_however_good_it_looks() {
        // The reported case: a champion the league never picks or bans, whose
        // win rate would otherwise put it at the top.
        let mut records = clustered_roster();
        records.push(ChampionRecord {
            champion_id: 900,
            key: "ogre".into(),
            matches: 2431.0,
            wins: 1420.0,
            presence: 0.004,
        });
        let assignments = classify(
            &records,
            &Model::default(),
            Mode::Percentile,
            &Shares::default(),
            &Thresholds::default(),
        );
        let ogre = assignments.iter().find(|entry| entry.key == "ogre").unwrap();
        assert_eq!(ogre.tier, Tier::None, "an uncontested champion reached {}", ogre.tier);
        // And it did not eat an S slot on the way past.
        assert_eq!(assignments.iter().filter(|entry| entry.tier == Tier::S).count(), 10);
    }

    #[test]
    fn a_champion_that_is_banned_rather_than_picked_still_rates() {
        // Presence counts bans, so a champion strong enough to be banned out
        // is not punished for the low pick count that causes.
        let mut records = clustered_roster();
        records.push(ChampionRecord {
            champion_id: 901,
            key: "banned_out".into(),
            matches: 30.0,
            wins: 21.0,
            presence: 0.40,
        });
        let assignments = classify(
            &records,
            &Model::default(),
            Mode::Percentile,
            &Shares::default(),
            &Thresholds::default(),
        );
        let entry = assignments.iter().find(|entry| entry.key == "banned_out").unwrap();
        assert_ne!(entry.tier, Tier::None);
    }

    #[test]
    fn the_presence_gate_can_be_switched_off() {
        let model = Model { min_presence: 0.0, ..Model::default() };
        let records = vec![ChampionRecord {
            champion_id: 1,
            key: "ogre".into(),
            matches: 500.0,
            wins: 300.0,
            presence: 0.0,
        }];
        let assignments =
            classify(&records, &model, Mode::Percentile, &Shares::default(), &Thresholds::default());
        assert_ne!(assignments[0].tier, Tier::None);
    }

    #[test]
    fn thin_sample_champions_get_no_tier_and_no_budget() {
        let mut records = clustered_roster();
        records.extend((200..220).map(|i| record(i, 2.0, 0.9)));
        let assignments = classify(
            &records,
            &Model::default(),
            Mode::Percentile,
            &Shares::default(),
            &Thresholds::default(),
        );
        assert_eq!(assignments.iter().filter(|entry| entry.tier == Tier::None).count(), 20);
        // The 100 rated champions still split by the configured shares.
        assert_eq!(assignments.iter().filter(|entry| entry.tier == Tier::S).count(), 10);
    }

    #[test]
    fn tied_champions_share_a_tier() {
        // 40 champions, all identical: no cut may run through the middle.
        let records: Vec<_> = (0..40).map(|i| record(i, 30.0, 0.5)).collect();
        let assignments = classify(
            &records,
            &Model::default(),
            Mode::Percentile,
            &Shares::default(),
            &Thresholds::default(),
        );
        let tiers: Vec<_> = assignments.iter().map(|entry| entry.tier).collect();
        assert!(tiers.windows(2).all(|pair| pair[0] == pair[1]), "tie split across tiers: {tiers:?}");
    }

    #[test]
    fn shares_over_one_do_not_produce_negative_bands() {
        let shares = Shares { s: 0.5, a: 0.5, b: 0.5, c: 0.5 };
        let assignments = classify(
            &clustered_roster(),
            &Model::default(),
            Mode::Percentile,
            &shares,
            &Thresholds::default(),
        );
        assert_eq!(assignments.iter().filter(|entry| entry.tier == Tier::S).count(), 50);
        assert_eq!(assignments.iter().filter(|entry| entry.tier == Tier::A).count(), 50);
        assert_eq!(assignments.iter().filter(|entry| entry.tier == Tier::B).count(), 0);
    }

    #[test]
    fn metric_pulls_thin_samples_toward_neutral() {
        let model = Model::default();
        let thin = model.metric(&record(1, 6.0, 1.0));
        let thick = model.metric(&record(2, 600.0, 1.0));
        assert!(thin < thick);
        assert!((thin - model.neutral).abs() < 0.06);
        assert!(thick > 0.85);
    }

    #[test]
    fn classification_is_stable_across_runs() {
        let records = clustered_roster();
        let first = classify(&records, &Model::default(), Mode::Percentile, &Shares::default(), &Thresholds::default());
        let second = classify(&records, &Model::default(), Mode::Percentile, &Shares::default(), &Thresholds::default());
        let ids = |list: &[Assignment]| list.iter().map(|e| (e.champion_id, e.tier)).collect::<Vec<_>>();
        assert_eq!(ids(&first), ids(&second));
    }

    #[test]
    fn empty_roster_is_handled() {
        let assignments = classify(&[], &Model::default(), Mode::Percentile, &Shares::default(), &Thresholds::default());
        assert!(assignments.is_empty());
    }
}
