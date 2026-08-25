# Original mod, tier list only

Configuration for `draft_winrate_penalty` (Win-Rate Ban/Pick AI + Champion
Tiers) that keeps its algorithm untouched and switches off only the ban/pick
adjustment. No new code — the answer is one line of `config.ini`.

한국어 문서: [README.ko.md](README.ko.md)

## The answer

The config text embedded in the mod's own binary says it outright:

```
# This mod has TWO independent features. Turn either off here.
#   draft_adjust : Feature 1 - adjust the competition AI's ban/pick evaluation
#   tier_assign  : Feature 2 - set your team's champion Tier list from stats
#   enabled      : master switch; false disables BOTH features
```

So `draft_adjust=false` with `tier_assign=true` is tier-list-only, running the
original's own win-rate model.

`config.ini` here is that, plus one more change: `tier_b` 0.48 → 0.500 and
`tier_c` 0.45 → 0.478, so B stops swallowing the roster. Both edits are marked
`CHANGED` in the file. `reference/original_defaults.ini` holds the stock
defaults verbatim, extracted from the binary.

## Install

Replace the mod's config:

```
steamapps\workshop\content\3009300\3741141600\config.ini
```

It hot-reloads within a few seconds.

## What still applies

Tiers use the **shared** win-rate model, so `neutral`, `prior`,
`confidence_k`, `min_matches`, `solo_weight`, `prev_weight`, `tier_s/a/b/c`
and `auto_tier` all stay live, including the patch blend:

```
effective m,w = current patch + pf * previous patch
pf = (1 - mc/(mc+confidence_k)) * prev_weight * (mp/(mp+confidence_k))
```

Inert: `scale`, `max_pen`, `bonus_scale`, `max_bonus`, `ban_weight`,
`low_threat_gate`, `position_flex`, `min_pos_ratio`, `min_pos_matches` — all
draft-scoring only. Left in the file so the feature is one edit away.

`patch_strength`, `patch_nerf_ratio` and `patch_prev_weight` are **uncertain**:
they sit in the shared block, but every description is in terms of "bias", a
Feature 1 term, and the tier metric is `neutral + (wr - neutral) * conf` with
no patch term. Probably tier-irrelevant; there is no source to confirm it.

## Caveats

**The UI override cannot be switched off.** `mod.override_info` remaps
`asset/base/ui/layout/champion_info` statically — package structure, not
configuration — so it loads whatever `draft_adjust` and `tier_assign` say. With
another tier-list mod, whichever loads last owns the screen; order comes from
`enable_mods` in `config\game\mods.json`.

**Do not run this alongside `winrate_tiers`.** Both write the same
`champion_tiers` field on the team record and will overwrite each other.

**The B pile-up is reduced, not solved.** Absolute cut-offs against a metric
that pulls thin samples toward 0.5 will always crowd the band straddling it;
raising `tier_b`/`tier_c` moves the crowd rather than removing it.

**There is no presence gate**, so a champion the competition scene never picks
or bans can still reach S on solo-rank win rate.

## Compared with `winrate_tiers`

| | original (tier only) | `winrate_tiers` |
|:---|:---|:---|
| tier split | absolute cut-offs | percentile shares |
| pick+ban presence gate | no | yes (`min_presence`) |
| patch weighting | yes | yes (same formula) |
| applied to | player's team | player's team (`apply_to_ai_teams`) |
| Champion screen UI | replaced, cannot disable | untouched |
| ban/pick AI | off via config | never had one |
| source available | no (binary only) | yes |
