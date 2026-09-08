# Hidden-information scenarios and title conformance

This reference preserves the scenario catalog that informed the implementation. It is a design and title-adoption checklist, not a claim that every listed game or scenario has shipped. The supported framework contract is in [Hidden information](hidden-information.md); current validation and remaining release work are linked there. Illustrative card-zone shapes and additional knowledge policies remain title-specific or future extensions.

## Card-game case studies

Hearts, Go Fish, basic draw-meld-discard Rummy, and War were used to test the model. Exact rule variants differ, but several common conclusions hold:

- shuffle establishes a secret ordered zone; an ordinary draw removes from that zone without consuming more randomness;
- a small number of Action families carry secret payloads, but many public Actions still validate or mutate private zones and therefore cannot automatically use canonical replay against every perspective;
- a complete Card identity is either present or omitted from a projection; generic unknown-card objects with stable identities are unnecessary and may create tracking leaks;
- retained Player knowledge may be supplied by visible Action History, by a current-state knowledge overlay, or by both; and
- concrete legal choices and validation failures are perspective-sensitive alongside state and Processed Actions.

### Hearts

A representative machine proceeds through deal, simultaneous pass submission, pass resolution, repeated card play and trick resolution, then hand scoring.

- Hidden state includes the shuffled deal, other Players' hands, and uncompleted pass selections.
- Public state includes scores, pass direction, turn, current and completed tricks, hand counts, and whether hearts are broken.
- A Player may retain exact knowledge of Cards they passed into another Player's otherwise private hand.
- When its type is disclosed, `SubmitPass` remains the same Action type for every recipient. Its actor-visible record can contain the Cards while another record contains only the permitted count or no payload. A UI phrase such as "pass submitted" is presentation, not a replacement Action type. If even `SubmitPass` is secret, its opaque record uses the platform sentinel and a forward patch rather than another game-semantic type.

An illustrative fixed-shape payload is:

```text
SubmitPass
├── cards: complete Card identities permitted in this record
└── unknownCount: additional submitted Cards omitted from this record
```

The canonical and submitting-Player records can carry three Cards and `unknownCount = 0`; an opponent record can carry no Cards and `unknownCount = 3`. The server must still reject an Unprocessed Action that attempts to submit unknown Cards: the permissive processed-record shape does not relax canonical command validation.

- Pass resolution naturally creates Player-specific projections because every Player receives a different set of Cards.
- An accepted `PlayCard` becomes public, but an opponent cannot run canonical validation that depends on the actor's hidden hand. A projected operation can remove the Card from the known subset when present or decrement the unknown count otherwise.
- Trick resolution and scoring are normally public and deterministic from already revealed Cards.

### Go Fish

A representative machine alternates between asking for a rank, resolving a transfer or miss, drawing after a miss, checking for a completed book, and choosing whether the same Player continues.

- Hidden state includes hands, stock order, and a privately drawn Card.
- Public state commonly includes the requested Player and rank, success or failure, permitted transfer count, hand and stock counts, completed books, and active Player.
- `AskForRank` may be public even though its validity proves a private fact about the asker's hand.
- Transfer records can disclose exact Cards to giver and receiver while disclosing only rank and count to other Players.
- A draw record can disclose the Card to the drawing Player and only count changes to others. If the rules require a matching draw to be shown, that result is public.
- Most turns branch on private hand or stock contents, so many Go Fish cascades are host-resolved even though their initiating User Action type is public.

### Rummy

A representative machine requires a draw, permits melds or layoffs, requires a discard, advances the turn, and eventually scores the round.

- Hidden state includes hands, stock order, private stock draws, and unsubmitted local selections.
- Public state commonly includes phase, active Player, stock count, discard pile, table melds, hand counts, and scores.
- A stock draw is host-resolved and projected privately; taking a public discard creates retained public knowledge that the Card entered that Player's hand.
- Accepted meld, layoff, and discard payloads become public, but their visible application still removes from a partially represented private hand.
- A stock reshuffle is host-only secret randomness. Whether remaining hands reveal during scoring is an explicit game rule rather than an automatic end-game policy.

### War

A representative machine deals, reveals battle Cards, compares them, places face-down Cards on a tie, repeats the reveal, collects the pot, and checks for game end.

- Both Players' future pile orders and face-down war Cards are hidden from every ordinary Player, including the pile owner.
- Public state includes pile counts, face-up battle Cards, face-down pot count, battle outcome, and game result.
- Most Players receive the same public view. Grouping equivalent projections is a possible optimization, not an implemented requirement.
- `RevealBattleCards` is host-resolved from hidden pile order, but its result immediately becomes public and can be represented by an executable result-bearing record or by a forward patch.
- Tie cascade length is derived from public revealed ranks under ordinary rules, so it does not add a hidden-existence leak.

These examples motivate possible reusable hidden-zone helpers; they do not establish a standard card-zone API. The implemented framework uses forward patches whenever permitted records cannot safely replay their visible consequences.

## Scenario catalog

### Information patterns

| ID  | Scenario                              | Required perspectives                                                          | Primary stress                             |
| --- | ------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| I1  | Hidden scalar, such as money          | Owner sees the value; others see nothing or an allowed indicator               | Owner and public patches differ            |
| I2  | Private hand mutation                 | Owner sees card identities; others see backs or a count                        | Arrays and placeholder handling            |
| I3  | One Action deals to several Players   | Each Player sees their own cards; public sees none                             | Potentially one result per Player          |
| I4  | Team or shared secret                 | A subset of Players shares exact information                                   | Audiences beyond owner and public          |
| I5  | Hidden pieces with a public aggregate | Exact contents are hidden; a count or capacity is public                       | Projection transforms structure            |
| I6  | Hidden deck order                     | Order and identities are hidden; size is public                                | Secret randomness and replay feasibility   |
| I7  | Private transfer or random theft      | Participants may learn different facts; others see only an occurrence or count | Multiple asymmetric perspectives           |
| I8  | Private observation                   | One Player peeks without publicly changing physical state                      | Durable Player knowledge                   |
| I9  | Simultaneous sealed submissions       | Owner sees their submission; others see submitted status                       | Concurrency and delayed resolution         |
| I10 | Progressive reveal                    | Owner-only information becomes team-visible and later public                   | Visibility changes over time               |
| I11 | Selective reveal                      | Only part of a hand, plan, or bid becomes public                               | Partial replacement of redacted structures |
| I12 | Permanently hidden information        | An unused deck, losing hand, or secret plan stays concealed after completion   | No implicit end-game disclosure            |

### Action and execution patterns

| ID  | Scenario                                              | Question exercised                                                                         |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A1  | Public Action with a private consequence              | Can the Action replay against every visible state?                                         |
| A2  | Public Action type with a secret payload              | Can the payload be projected while preserving correct visible execution?                   |
| A3  | Secret-dependent public consequence                   | Can a client reach the public result without knowing the secret input?                     |
| A4  | Hidden Action type                                    | Can an opaque Action envelope advance state, or is a forward patch required?               |
| A5  | Action changes another Player's secret                | Are all asymmetric results produced rather than assuming actor and public results suffice? |
| A6  | Processed-result metadata contains secrets            | Are history descriptions, animation metadata, and result metadata projected?               |
| A7  | Canonical undo contains secrets                       | Is each visible undo patch independently derived from projected states?                    |
| A8  | Canonical and visible undo operations happen to match | Do client interfaces still exclude the canonical patch conceptually and operationally?     |
| A9  | Legal choices depend on private state                 | Are valid Action types and concrete choices returned only to entitled Players?             |
| A10 | Validation or rejection explains a secret             | Does an error reveal only the permitted reason rather than a hidden rule fact?             |

### System Action patterns

| ID  | Scenario                                            | Primary stress                                                                                        |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| S1  | Public User Action produces public System Actions   | Existing deterministic cascades continue working                                                      |
| S2  | Public User Action produces a private System Action | Perspectives receive different visible consequences                                                   |
| S3  | Secret User Action produces a public resolution     | Opponents cannot necessarily replay the initiating Action                                             |
| S4  | System Action depends on hidden state               | A redacted runtime may choose a different transition or fail validation                               |
| S5  | System Action creates private random results        | Server-only randomness may prevent client replay                                                      |
| S6  | Mixed cascade                                       | One User Action produces several public and private System Actions                                    |
| S7  | Patched cascade                                     | Every Processed Action identity and index still reaches the client                                    |
| S8  | System Action IDs consume the state PRNG            | Concealing random state does not break Action identity or synchronization                             |
| S9  | Perspective-specific cascade mode                   | Is one complete cascade replayed for one perspective and patched atomically for another?              |
| S10 | Secret-dependent cascade length                     | Does the common Action checksum intentionally make the existence and number of System Actions public? |

### Hosted Game workflows

| ID  | Scenario                                              | Expected behavior                                                                         |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| H1  | Initial load                                          | The server returns the requesting perspective's current state and visible Action records  |
| H2  | Acting Player submits an ordinary Action              | Optimistic replay works when the visible result is replayable                             |
| H3  | Acting Player submits an Information-Revealing Action | The client waits for authoritative acceptance as it does today                            |
| H4  | Another Player receives a Realtime Update             | Only that Player's result and visible undo patch arrive                                   |
| H5  | Realtime discontinuity                                | Reconciliation returns only permitted visible Action records                              |
| H6  | Simultaneous stale submission                         | Missing Actions are projected for the requester                                           |
| H7  | Full synchronization                                  | Current visible state and visible Action history agree                                    |
| H8  | Reconnect after a reveal                              | The client receives everything currently permitted without canonical remnants             |
| H9  | Server rejects an optimistic Action                   | The client restores its prior visible state without canonical data                        |
| H10 | Cache or ETag reuse                                   | One Player's projected response is never served to another Player                         |
| H11 | Developer Debug or Admin Mode is enabled              | A fresh Host Game Context supplies canonical state, history, patches, and updates         |
| H12 | Developer/Admin Host View is exited                   | The Host Game Context is discarded and a fresh ordinary projection replaces it            |
| H13 | Inspector selects Acting Player view                  | A fresh projection of retained canonical state and history replaces the displayed context |

### Undo and local History View

| ID  | Scenario                                 | Expected behavior                                                                    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| U1  | Local History Step backward              | Navigation uses only the stored visible undo patch                                   |
| U2  | Local History Step forward               | Navigation replays the stored visible Action or applies its visible forward patch    |
| U3  | Server-authorized Undo                   | The backend reverses canonical history and supplies the permitted replacement suffix         |
| U4  | Undo reapplies simultaneous submissions  | Every retained or redone User and System Action is projected again for the recipient |
| U5  | Undo crosses an information reveal       | Existing information-reveal policy prevents unauthorized reversal                    |
| U6  | Reveal has perspective-specific undo     | An informed Player and uninformed opponents receive different inverse changes        |
| U7  | Repeated backward and forward navigation | Visible state round-trips without divergence                                         |

### Knowledge and lifecycle

| ID  | Scenario                            | Question exercised                                                                                                    |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| K1  | Player sees a card that later moves | Where is the Player's retained knowledge recorded?                                                                    |
| K2  | Player forgets information by rule  | Can knowledge entitlement be explicitly removed?                                                                      |
| K3  | Player Perspective changes          | Is a complete projection derived from canonical data and substituted without merging the prior perspective's secrets? |
| K4  | Spectator observes                  | Does the public perspective have a complete safe projection?                                                          |
| K5  | Developer or administrator inspects | Is explicit Host View canonical access isolated from ordinary Player delivery?                                        |
| K6  | Game Instance finishes              | Which secrets reveal, and which remain hidden permanently?                                                            |
| K7  | Exploration begins                  | It may reveal only hypothetical unknowns consistent with permitted knowledge; see [Exploration](hidden-information-exploration.md).                   |
| K8  | Hosted Fork is created              | The host copies the real canonical fork point, including hidden state and random cursors.                                                 |
| K9  | Game Title publication changes      | Do delivered visible Action records and current projection rules remain compatible?                                   |

## Conformance checks for title adoption

Evaluate participating Action fixtures for each relevant Player and spectator Perspective. Given canonical before-state `C0`, Action `A`, and after-state `C1`, derive projected states `V0` and `V1`, the permitted Action record `Av`, and its visible undo patch `Uv = diff(V1, V0)`. Verify the following, within the supported History/schema boundary:

1. Visible state, Action contents, metadata, and patches contain no unauthorized canonical values.
2. Stored state schemas do not encode perspectives as visibility-discriminated union branches.
3. Visible replay produces `V1`, or an explicit visible forward patch does.
4. Forward and undo patches are deterministic functions of safe projected states rather than filtered canonical patches.
5. Applying `Uv` to `V1` restores `V0`, and reapplying the visible transition restores `V1`.
6. A disclosed Action record retains the canonical game-semantic type; an undisclosed type uses only the reserved redaction sentinel and a forward patch.
7. A sentinel Action record is never hydrated or executed by the game runtime.
8. Every visible result retains the same canonical Action identity and index.
9. One perspective uses one classified transition mode for the complete initiating User Action and System Action cascade.
10. A patched cascade includes every Action identity and index required by the Action History Checksum, including entries with no visible state effect.
11. Initial load, synchronization, Realtime Updates, and Action responses materialize compatible projected results and cascade modes for a perspective.
12. Legal choices, client-visible rejection reasons, history descriptions, and animation metadata reveal no additional canonical information.
13. No ordinary Player or spectator interface or fallback can expose a canonical undo patch.
14. Repeated backward and forward History Navigation remains stable.
15. Enabling Developer Debug Mode or Admin Mode replaces the active client data with a separately authorized Host Game Context containing canonical state, Action history, patches, and updates.
16. Once neither Developer Debug Mode nor Admin Mode remains enabled, the client discards the Host Game Context and fully reloads the ordinary projected context without retaining canonical records.
17. Host View, Acting Player, and displayed Player Perspective remain independent; selecting an Acting Player does not itself leave Host View, and an explicit perspective toggle does not discard the retained canonical context.
18. The same submission against canonical states with the same submitting-Player projection does not produce distinguishable acceptance or rejection because of unavailable protected information, unless that distinction is an intentional rules-defined reveal.
19. The Game Title treats Processed Action existence, identity, index, order, and count as public and does not encode a protected fact into variable cascade length unless that disclosure is permitted.
20. An ordinary state projection contains neither the protected PRNG seed nor its invocation position; a patched hidden cascade advances the public cursor, and a later replayable cascade produces canonical System Action identities and checksum.

