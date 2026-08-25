# Win-Rate Champion Tiers

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
percentile budget.

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
cargo test                                           # pure logic, no game needed
```

Rename the Linux output to `winrate_tiers.so` when installing (cargo prefixes
it with `lib`).

## Files the mod writes

Next to the mod binary:

- `config.ini` — settings, hot-reloaded within a few management ticks.
- `winrate_tiers.log` — what it found and what it wrote. The server hooks get
  a `StableServerCtx`, which has no log slot, and `StableHost` must not be
  stored past its callback, so the log goes to a file.
- `tier_table.txt` — the assignment, with each champion's game count and
  metric, plus the resulting distribution.
- `schema_dump.txt` — everything the server side can see in the save.

## Status: schema binding is not pinned yet

The stable ABI hands out game records as opaque JSON and has **no
champion-tier slot** — tiers live somewhere inside the team document, and the
per-champion win/loss table lives somewhere inside a record document. Neither
shape is documented, and the mod this grew out of shipped only as a compiled
DLL, so there was no source to read them off.

So both ends are **discovered at runtime** (`src/schema.rs`) rather than
hard-coded:

- the **sink** — a team-document key named like a tier list whose value is
  shaped like one (champion→label map, champion→index map, or one bucket
  array per tier);
- the **source** — a table whose rows carry a champion identifier plus a
  games-played and a games-won count.

Discovery is conservative: it declines to write rather than guessing at a
field it is not confident about, and says so in the log. `schema_dump.txt`
exists to close this loop — it reports the real layout so the paths can be
pinned exactly in a follow-up version.
