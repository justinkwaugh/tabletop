# Actions carry the runs a client solved

An 18xx Run Instruction lets a company run and pay out without its president, but running means finding the company's best run, and the solver that does it is a WebAssembly search bounded by wall-clock time that only clients load. The Game Runtime cannot call it and stay deterministic ([ADR 0001](0001-shared-deterministic-game-runtime.md)). So the client that submits an Action solves any instructed company the Action could affect and attaches the result to the Action itself, as `instructedRuns`, a list of runs per company: one for each time the Action's System cascade runs that company's trains under its instruction, then one for the position it ends in. The runtime stores them when it processes the Action and spends them as the cascade reaches each turn, so every environment that executes the Action, including replay, reaches the same System Actions from Game State and ordered Actions alone.

The runtime checks that an attached run is legal and compares its revenue with the declared run, but it cannot check that the run is the best one. Clients are trusted for that, as the user decided: a modified client could attach a weak legal run for a rival's company. Every 18xx Action schema gains the optional field, because any Action's cascade can reach an instructed company's turn.

## Considered Options

- **The runtime solves.** It needs the WebAssembly in every Logic Artifact, loaded by the backend as well as every client, and a step budget instead of a time limit to stay deterministic. Solving once, in the client whose Action changed the run, needs neither.
- **A follow-up refresh Action.** The acting client would submit an Out-of-Turn refresh after its Action. A company whose turn falls inside the first Action's cascade would already have run the stale run.
- **Refresh only on Actions that change routes.** A cascade from any Action, even a stock pass, can export trains and reach an instructed company, so the field belongs on every 18xx Action.

## Consequences

- The run refresh is a client responsibility. A client that cannot solve exhaustively attaches an unsolved marker, which stops the instruction rather than running a run nobody proved.
- Each run records an opaque key of the solver input it was solved for. Only clients read it, to decide whether a position needs solving; a stale or mistaken run therefore gets refreshed by the next acting client.
- Adding the field changes every 18xx title's runtime contract, so adopting it needs a logic major and a UI republish for each title. The Game UI Host Bridge Contract ([ADR 0004](0004-game-ui-host-bridge-contract.md)) is unchanged: the run travels inside the Action.
