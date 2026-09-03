# Isolate Game UIs behind the Game UI Host Bridge Contract

Game UI Artifacts are independently implemented, versioned, and published client modules loaded by the Site Frontend Artifact, following a game-specific microfrontend pattern. Their isolation contains title-specific implementation and failures so one Game Title cannot interfere with another or with the Site Frontend Artifact; it does not prevent a Game UI Artifact from using host-owned functionality. They communicate through the stable, bidirectional Game UI Host Bridge Contract so either artifact can change without requiring an atomic publication of the other.

The contract includes every host-owned capability intentionally supplied to code from a Game UI Artifact and every Game Session presentation value or command exposed back to host-owned UI. `BridgedContext` and the other dependencies injected when the Site Frontend Artifact instantiates a Game UI Artifact's session class supply host capabilities; `GameSessionBridge` exposes Game Session presentation state and commands in the other direction. An interface remains part of this cross-artifact contract when it is richer than the named bridge objects or when both implementations live in the same source repository.

A UI Artifact bundles the shared Game Client implementation present when that artifact is published, including its base `GameSession`, while its injected host dependencies come from the currently loaded Site Frontend Artifact. A newer Site Frontend Artifact can therefore run with an older Game Session implementation. Publishing the Site Frontend Artifact alone does not update shared client code already bundled into UI Artifacts.

## Consequences

- Site Frontend and Game UI Artifact versions may coexist in older/newer combinations during independent publication and client caching.
- Host capabilities and result shapes remain backward compatible across supported mixed-artifact combinations, regardless of whether they are exposed through a named bridge object or another injected dependency.
- Each Game Title needs a new UI-only Publication to adopt a shared Game Client implementation change bundled into its UI Artifact. Its Logic Artifact does not need republishing when the embedded Game Runtime is unchanged.
- Removing or changing a contract member requires explicit contract versioning or a staged migration of the Site Frontend and every affected UI Artifact, with allowance for already-loaded older clients.
- Apparent lack of current source-tree consumers is insufficient evidence that a contract member is unused because its consumer may exist in another deployed artifact version.
