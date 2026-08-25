# Win-Rate Champion Tiers

한국어 문서: [README.ko.md](README.ko.md)

Builds an S/A/B/C/D champion tier list from in-game win-rate statistics and
writes it to **your team only**.

Built against the stable-ABI mod SDK in `../mod-sdk-stable`. It registers a
server extension and nothing else — no draft-score hook, no UI override — so
it composes with a separate ban/pick mod instead of fighting it for the
Champion screen.

## What it changes

**Tiers are handed out by share, not by fixed cut-offs.** The metric is
`neutral + (wr - neutral) * conf`, which pulls thin-sample champions toward
the break-even rate. Absolute cut-offs then dump most of the roster into
whichever band straddles that rate — which is why a threshold-based tier list
comes out almost entirely B. Ranking the roster and slicing it by share makes
the distribution a config value instead:

| tier | default share |
|------|---------------|
| S    | 10%           |
| A    | 20%           |
| B    | 30%           |
| C    | 25%           |
| D    | 15% (remainder) |

Champions under `min_matches` effective games get no tier and do not consume
percentile budget — excluding them from the tiers but not from the budget
would let champions with no record take up the S slots.

`mode=threshold` restores absolute cut-offs if you prefer them.

**The list goes to your team only.** `apply_to_ai_teams` defaults to `false`.
Writing one solved tier list to every AI team is what makes the whole league
ban and pick the same champions.

## Install

Copy into `mods/winrate_tiers/` in the game folder:

```
mods/winrate_tiers/
  winrate_tiers.dll     (Windows)   or  winrate_tiers.so (Linux)
  mod.mod_info
  config.ini            (optional - written with defaults on first run)
```

## Build

```
cargo build --release                                # Linux  -> libwinrate_tiers.so
cargo build --release --target x86_64-pc-windows-gnu # Windows -> winrate_tiers.dll
cargo test                                           # logic + real-save fixtures, no game needed
```

Rename the Linux output to `winrate_tiers.so` when installing (cargo prefixes
it with `lib`).

## Files the mod writes

Next to the mod binary:

- `config.ini` — settings, hot-reloaded within a few management ticks.
- `winrate_tiers.log` — what it found and what it wrote. The server hooks get
  a `StableServerCtx`, which has no log slot, and `StableHost` must not be
  stored past its callback, so the log goes to a file. A failure says which
  step failed: the field was not found, the game rejected the write, or the
  write did not survive a read-back.
- `player_team.json` — the player's team document in full, unclamped. The
  report truncates long documents; this one is the document that matters.
- `tier_table.txt` — the assignment, with each champion's game count and
  metric, plus the resulting distribution.
- `schema_dump.txt` — everything the server side can see in the save.

## Schema

Both ends are pinned against a `schema_dump.txt` taken from a real save.

**Source — champion win/loss.** `LeagueCompetition` and `TournamentCompetition`
carry `statistics`, keyed by athlete id, each holding `champion_detail`:

```
statistics.<athlete>.champion_detail.<champion> = { matches, wins, dealing, healing, rating, tanking }
```

Summing over athletes gives the champion's pick and win count. Records carry
`finalized`, so a finished competition is read once and cached.

`SoloRankMatch` is one document per match — `blue_team[]`/`red_team[]` rows
name a `champion` and `blue_team_win` decides the result. These documents are
large and there are thousands, so only the scalar fields that matter are read
by path and each match id is counted once. The first pass walks them all;
later passes are incremental.

**Sink — the tier list.** `champion_tiers` on the team record, a champion key
to `"S"`/`"A"`/`"B"`/`"C"`/`"D"` map. It is **per team**, which is what makes
writing yours leave the other 119 teams on their vanilla tiers.

The schema has no "no tier" value — all 57 champions carry one — so `unrated`
defaults to `keep`: a champion the stats cannot rate retains the tier the save
already had, keeping the document in a shape the game accepts.

The path is still searched rather than hard-coded, so a renamed field in a
later build degrades to "found nothing and said so" instead of writing to the
wrong place; `tier_path` pins it outright (and a pinned path is honoured even
when the shape is unfamiliar). Value shapes are validated, so the neighbouring
`merchandise_facility_grade: "S"` and `stadium.grade: "S"` are not mistaken
for tier maps.

Recognition is deliberately tolerant: a map counts as a tier list when its
values are strings and **at least one** is a real tier label. A save another
tier mod has already touched carries entries outside S/A/B/C/D — the schema
has no "no tier" value, so mods invent one — and those entries are preserved
untouched through a write.

> Two versions failed at this step, both by being too strict.
> v0.1's candidate list held the singular `champion_tier` and compared by
> exact match, missing the real plural `champion_tiers` by one letter.
> v0.2 matched the name but demanded every one of the 57 entries be
> S/A/B/C/D, so a single foreign value on the player's previously-modded team
> hid the whole field — while the pristine AI teams in the dump read fine,
> which is exactly why the bug was invisible in the fixtures.

**Not implemented: per-patch weighting.** The `version` field that identifies
a balance patch exists only on `SoloRankMatch` and `MatchReplay`, not on the
competition aggregates, so competition stats cannot be split by patch from
these records. There is deliberately no `prev_weight` setting rather than one
that quietly does nothing.

## Verification

`tests/fixtures/` holds verbatim excerpts from a real save, and
`tests/real_save.rs` runs the pipeline over them. On one season of competition
data (65 athletes, 41 champions, 1192 games):

| mode | S | A | B | C | D | no tier |
|:---|--:|--:|--:|--:|--:|--:|
| old cut-offs (0.55/0.52/0.48/0.45) | 2 | 4 | **18** | 8 | 2 | 7 |
| relaxed cut-offs (0.55/0.52/0.50/0.478) | 2 | 4 | **15** | 3 | 10 | 7 |
| percentile (10/20/30/25/15) | 3 | 7 | **11** | 8 | 5 | 7 |

B goes from 53% to 32% of the rated roster. The tests also assert the
aggregate win rate lands near 50%, which catches an aggregation that doubles
or drops rows.
