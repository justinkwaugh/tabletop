# Deployed game fixture

`state.json` is the latest canonical State of the one Hosted Game of The Old Prince
that existed on 2026-09-21, and `actions.json` is its complete Action history, newest
first, as exported from the deployment. Player and game identifiers are opaque; the
export contains no names or addresses.

`src/deployedGame.spec.ts` uses them to hold Operational Compatibility: the current
Game Runtime must load this State unchanged, offer its active player the same Actions,
and reproduce each recorded State from the Action that produced it. Do not edit or
regenerate these files. The game was played across several logic versions; the spec
names the recorded transitions that current logic is known to reproduce differently.
