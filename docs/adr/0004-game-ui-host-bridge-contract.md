# Isolate Game UIs behind the Game UI Host Bridge Contract

Game UI Artifacts are independently implemented, versioned, and published client modules loaded by the Site Frontend Artifact, following a game-specific microfrontend pattern. They communicate through the stable, bidirectional Game UI Host Bridge Contract so a Game Title's UI can change without rebuilding or modifying the Site Frontend Artifact.

The current contract is implemented by `BridgedContext`, which supplies host-owned services to a Game UI Artifact, and `GameSessionBridge`, which exposes Game Session presentation state and commands to host-owned UI. Code inside either artifact may delegate from the bridge to richer internal APIs, but those internal APIs are not substitutes for the cross-artifact contract.

## Consequences

- Site Frontend and Game UI Artifact versions may coexist in older/newer combinations during independent publication and client caching.
- Bridge changes remain backward compatible across supported combinations; adding an internal method does not justify removing its bridge entry.
- Removing or changing a bridge member requires explicit contract versioning or a coordinated migration of the Site Frontend and every affected Game UI Artifact.
- Apparent lack of source-tree consumers is insufficient evidence that a bridge member is unused because its consumer may exist in another deployed artifact version.
