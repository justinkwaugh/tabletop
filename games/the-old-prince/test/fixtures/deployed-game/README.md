# Deployed game fixture

`state.json` is the latest canonical State of the one Hosted Game of The Old Prince
that existed on 2026-09-21, and `actions.json` is its complete Action history, newest
first, as exported from the deployment. Player and game identifiers are opaque; the
export contains no names or addresses.

`src/deployedGame.spec.ts` replays them against current logic. It rebuilds each
recorded State from the Actions' undo patches and converts it to the current state shape
with `currentShape`, which grows with each deliberate state-shape change. Current logic
must load the converted latest State, offer its active player the same Actions, and
reproduce each converted State from the Action that produced it. Do not edit or
regenerate these files. The game was played across several logic versions; the spec
names the recorded transitions that current logic is known to reproduce differently.
