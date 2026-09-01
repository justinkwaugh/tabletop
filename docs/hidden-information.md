# Hosted Game Hidden Information

## Status and purpose

This document records the current theoretical model and scenario catalog for preventing a Hosted Game Client from receiving information its Player Perspective is not allowed to know. The capability is not implemented, and unresolved choices in this document are not architectural decisions.

The catalog is intended to evaluate proposed designs and later serve as an acceptance-test matrix. A design is incomplete if it protects ordinary state delivery but leaks information through Actions, undo patches, System Action cascades, synchronization, persistence, or another Hosted Game flow.

## Scope and working assumptions

- Confidentiality is required for Hosted Games. Hotseat concealment remains a presentation convention and is outside this security model.
- A Game Title explicitly participates in hidden-information support. Existing Game Titles need not work without being redesigned or migrated.
- The host retains the complete canonical Game State and Canonical Action History.
- The UI presents information but is not a confidentiality control. Unauthorized canonical data must never reach the client.
- The existence and ordering of Processed Actions are currently assumed to be public because the Action History Checksum depends on Action identity and index. Whether Action type, source, or Player attribution is always public remains open.
- Deterministic client replay remains the preferred forward-transition mechanism. Player-relative forward patches are a possible extension, not a decided requirement.

## Theoretical model

### Canonical model

The backend stores one complete canonical Game State and one Canonical Action History. Each canonical Processed Action contains everything needed for authoritative validation, execution, replay, and Action Reversal, including its canonical undo patch.

Canonical undo patches are backend-only. A client never receives or has a code path to access one, even when a permitted patch would happen to contain identical operations.

### Player-relative projection

A participating Game Title projects canonical information for a Player Perspective. Projection can omit information, replace it with a placeholder or aggregate, retain it for an entitled Player, or reveal it when the rules permit.

Conceptually:

```text
visibleState = projectState(canonicalState, perspective)
visibleAction = projectAction(canonicalAction, perspective)
```

A public or spectator view can be represented as another perspective. Different Players may receive different projections of the same canonical transition.

### Visible transitions and Action Reversal

For a canonical transition `C0 --A--> C1`, the backend derives the following for each relevant perspective `P`:

```text
V0(P) = projectState(C0, P)
V1(P) = projectState(C1, P)
Av(P) = projectAction(A, P)
Uv(P) = diff(V1(P), V0(P))
```

`Av(P)` is the permitted visible Action variant. `Uv(P)` is its visible undo patch. The visible undo patch is calculated from two already-safe projected states; it is not produced by filtering operations out of the canonical undo patch. Filtering a canonical patch could produce incorrect array indices, invalid structural changes, or secret replacement values.

The preferred forward invariant is deterministic visible replay:

```text
apply(V0(P), Av(P)) = V1(P)
```

A participating Game Title may need to record processed-result metadata in an Action so each permitted variant has enough information to reproduce its visible consequence. If this invariant cannot be satisfied without revealing a secret, an explicit visible forward patch could instead be used:

```text
Fv(P) = diff(V0(P), V1(P))
applyPatch(V0(P), Fv(P)) = V1(P)
```

Whether the platform must support this second transition form remains open.

### Action identity and variants

Every visible Action variant preserves the canonical Action identity and index required by the Action History Checksum. Other Action fields are projected.

Variants are organized by distinct visible result rather than a fixed actor-versus-opponents rule. Players whose visible Action contents and patches are identical belong to the same tentative **Visibility Equivalence Class**, allowing one stored variant to serve several perspectives.

Common public Actions normally have one shared variant. A private draw may have an owner variant and a public variant. A single deal to four Players may require four Player variants plus a public variant because each Player sees a different hand.

### Persistence shape

The working persistence model stores one canonical current state and augments each canonical Processed Action with its distinct visible variants:

```text
Canonical current state

Canonical Processed Action
├── full canonical contents
├── canonical undo patch
└── visible variants
    ├── audience
    ├── permitted Action contents
    ├── visible undo patch
    └── optional visible forward patch
```

This does not require a complete current-state copy for every Player. Initial load and full synchronization can project the one canonical current state for the requesting Player Perspective. Action variants and their patches should be committed atomically with the canonical transition so projection failure cannot leave a partially updated Game Instance.

Persisted player-relative state or a smaller knowledge overlay may still be required when knowledge cannot be derived from current canonical state. For example, a Player may remain entitled to remember a card after the card moves elsewhere. The representation of durable Player knowledge is unresolved.

### Game Client and History View

A Hosted Game Client receives only its visible Game State, permitted Action variants, and visible undo patches. History View is derived locally from those inputs and therefore needs no separate confidentiality mechanism.

The History invariant is:

```text
visible state + visible Actions + visible undo patches
    -> only visible historical states
```

Local backward navigation uses visible undo patches. Local forward navigation replays the same visible Action variants originally delivered, or would apply their visible forward patches if that transition form is adopted.

### System Action cascades

The current Game Client ordinarily receives a User Action and deterministically regenerates its System Action cascade, including deterministic System Action identities. Hidden information can prevent that replay when a System Action depends on secret state or server-only randomness.

If a visible forward patch is used, the server must still deliver every Processed Action identity and index needed for the Canonical Action History and Action History Checksum. It may need to deliver a visible transition for each System Action or a batch that explicitly contains every Action envelope and corresponding state transition.

The state PRNG requires particular scrutiny. System Action IDs currently consume it, while a secure hidden deck may require withholding random state that would allow a client to reconstruct a shuffle. Participating Game Titles may need to separate public deterministic identity generation from server-only secret randomness.

## Scenario catalog

### Information patterns

| ID | Scenario | Required perspectives | Primary stress |
| --- | --- | --- | --- |
| I1 | Hidden scalar, such as money | Owner sees the value; others see nothing or an allowed indicator | Owner and public patches differ |
| I2 | Private hand mutation | Owner sees card identities; others see backs or a count | Arrays and placeholder handling |
| I3 | One Action deals to several Players | Each Player sees their own cards; public sees none | Potentially one variant per Player |
| I4 | Team or shared secret | A subset of Players shares exact information | Audiences beyond owner and public |
| I5 | Hidden pieces with a public aggregate | Exact contents are hidden; a count or capacity is public | Projection transforms structure |
| I6 | Hidden deck order | Order and identities are hidden; size is public | Secret randomness and replay feasibility |
| I7 | Private transfer or random theft | Participants may learn different facts; others see only an occurrence or count | Multiple asymmetric perspectives |
| I8 | Private observation | One Player peeks without publicly changing physical state | Durable Player knowledge |
| I9 | Simultaneous sealed submissions | Owner sees their submission; others see submitted status | Concurrency and delayed resolution |
| I10 | Progressive reveal | Owner-only information becomes team-visible and later public | Visibility changes over time |
| I11 | Selective reveal | Only part of a hand, plan, or bid becomes public | Partial replacement of redacted structures |
| I12 | Permanently hidden information | An unused deck, losing hand, or secret plan stays concealed after completion | No implicit end-game disclosure |

### Action and execution patterns

| ID | Scenario | Question exercised |
| --- | --- | --- |
| A1 | Public Action with a private consequence | Can the Action replay against every visible state? |
| A2 | Public Action type with a secret payload | Can the payload be projected while preserving correct visible execution? |
| A3 | Secret-dependent public consequence | Can a client reach the public result without knowing the secret input? |
| A4 | Hidden Action type | Can an opaque Action envelope advance state, or is a forward patch required? |
| A5 | Action changes another Player's secret | Are all asymmetric variants produced rather than assuming actor and public variants suffice? |
| A6 | Processed-result metadata contains secrets | Are history descriptions, animation metadata, and result metadata projected? |
| A7 | Canonical undo contains secrets | Is each visible undo patch independently derived from projected states? |
| A8 | Canonical and visible undo operations happen to match | Do client interfaces still exclude the canonical patch conceptually and operationally? |

### System Action patterns

| ID | Scenario | Primary stress |
| --- | --- | --- |
| S1 | Public User Action produces public System Actions | Existing deterministic cascades continue working |
| S2 | Public User Action produces a private System Action | Perspectives receive different visible consequences |
| S3 | Secret User Action produces a public resolution | Opponents cannot necessarily replay the initiating Action |
| S4 | System Action depends on hidden state | A redacted runtime may choose a different transition or fail validation |
| S5 | System Action creates private random results | Server-only randomness may prevent client replay |
| S6 | Mixed cascade | One User Action produces several public and private System Actions |
| S7 | Patched cascade | Every Processed Action identity and index still reaches the client |
| S8 | System Action IDs consume the state PRNG | Concealing random state does not break Action identity or synchronization |

### Hosted Game workflows

| ID | Scenario | Expected behavior |
| --- | --- | --- |
| H1 | Initial load | The server returns the requesting perspective's current state and Action variants |
| H2 | Acting Player submits an ordinary Action | Optimistic replay works when the visible variant is replayable |
| H3 | Acting Player submits an Information-Revealing Action | The client waits for authoritative acceptance as it does today |
| H4 | Another Player receives a Realtime Update | Only that Player's variant and visible undo patch arrive |
| H5 | Realtime discontinuity | Reconciliation returns only permitted Action variants |
| H6 | Simultaneous stale submission | Missing Actions are projected for the requester |
| H7 | Full synchronization | Current visible state and visible Action history agree |
| H8 | Reconnect after a reveal | The client receives everything currently permitted without canonical remnants |
| H9 | Server rejects an optimistic Action | The client restores its prior visible state without canonical data |
| H10 | Cache or ETag reuse | One Player's projected response is never served to another Player |

### Undo and local History View

| ID | Scenario | Expected behavior |
| --- | --- | --- |
| U1 | Local History Step backward | Navigation uses only the stored visible undo patch |
| U2 | Local History Step forward | Navigation replays the stored visible Action or applies its visible forward patch |
| U3 | Server-authorized Undo | The backend reverses canonical history and reports changed Action identities |
| U4 | Undo reapplies simultaneous submissions | Every redone Action is projected again for each recipient |
| U5 | Undo crosses an information reveal | Existing information-reveal policy prevents unauthorized reversal |
| U6 | Reveal has perspective-specific undo | An informed Player and uninformed opponents receive different inverse changes |
| U7 | Repeated backward and forward navigation | Visible state round-trips without divergence |

### Knowledge and lifecycle

| ID | Scenario | Question exercised |
| --- | --- | --- |
| K1 | Player sees a card that later moves | Where is the Player's retained knowledge recorded? |
| K2 | Player forgets information by rule | Can knowledge entitlement be explicitly removed? |
| K3 | Player Perspective changes | Is the client replaced or synchronized without retaining the prior perspective's secrets? |
| K4 | Spectator observes | Does the public perspective have a complete safe projection? |
| K5 | Administrator inspects | Is canonical access explicit and isolated from ordinary Player delivery? |
| K6 | Game Instance finishes | Which secrets reveal, and which remain hidden permanently? |
| K7 | Exploration begins | Can it reveal hidden deck order or another unknown future? |
| K8 | Hosted Fork is created | What knowledge and hidden state may the derived Game Instance retain? |
| K9 | Game Title publication changes | Do stored Action variants and current projection rules remain compatible? |

## Conformance checks

Every participating Action fixture should be evaluated for every relevant Player Perspective. Given canonical before-state `C0`, canonical Action `A`, and canonical after-state `C1`, calculate `V0`, `V1`, `Av`, and `Uv` as defined above and verify:

1. Visible state, Action contents, metadata, and patches contain no unauthorized canonical values.
2. Visible replay produces `V1`, or an explicit visible forward patch does.
3. Applying `Uv` to `V1` restores `V0`.
4. Reapplying the visible transition restores `V1`.
5. Every variant retains the same canonical Action identity and index.
6. Grouping identical variants does not change any recipient's result.
7. The complete User and System Action cascade preserves the Action History Checksum.
8. Persistence, synchronization, Realtime Updates, and Action responses select the same variant for a perspective.
9. No client interface or fallback can expose a canonical undo patch.
10. Repeated backward and forward History Navigation remains stable.

## Open questions

- Must the platform support visible forward patches, or must every participating Game Title provide replayable visible Actions?
- Are Action type, source, and Player attribution always visible even though Action identity and index are assumed visible?
- Does a later reveal leave earlier stored Action variants unchanged, enrich them, or maintain both event-time and current-knowledge representations?
- Is durable Player knowledge stored in canonical state, in a separate knowledge model, or in persisted player-relative projections?
- What exact interface does a participating Game Runtime expose for state and Action projection?
- Are visible variants stored with canonical Actions or in separately protected persistence records?
- How are public spectators, administrators, Player reassignment, and post-game visibility represented?
- How are projection changes handled when a Hosted Game follows a newer Game Title publication?
