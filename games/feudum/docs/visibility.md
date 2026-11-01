# Feudum visibility

Feudum registers state and Action projection (`runtime.visibility.state` and `runtime.visibility.actions`). The contract follows `docs/hidden-information.md`. Rules are cited as `R-x.y` from `rules-digest.md`, house rulings as `R-x.y-Hn` and implementation rules as `R-X.n` from `rulings.md`.

## What is concealed

Every concealed order and identity lives in one host-only field of canonical state, the vault. Rule methods reach it through `requireVault()`, so a projected client that runs into a concealed read fails guarded execution and defers to the host.

| Vault field                                                                                                                                     | Hidden by | Public state carries                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Royal Writ deck order                                                                                                                           | R-5.1     | the deck count, as the slot numbers `top` and `nextBottom`; `publicDeckWrits`, the writs the table saw go under the deck (played mandates and discards, R-4.4.2, R-4.4.4), each with its slot |
| Seal pile order and identities                                                                                                                  | R-5-H1    | the pile count                                                                                                                                                                                |
| The identity of every other seal red side up: on a Noble scroll space, held by a player, on a sealed charter, under a marker for Royal Immunity | R-5-H1    | which scroll spaces hold a seal; each player's seal count and sealed-charter count; which markers are immune                                                                                  |

A seal's identity fixes its bead value, so a seal red side up is anonymous in public state and named only when it flips to a bead (R-5-H1). A bead that flips back to a seal (favours, R-3.11.2) or returns to the pile (R-3.13.2) goes back into the vault; a return to the pile reshuffles it from the protected stream. The protected random cursor and the reproduction master seed are concealed as the platform defines.

The haversack is not concealed (R-5.4-H1). Every good outside it is public (R-5.3), so its contents follow from public state; state stores its count of each good, and a draw is a random pick from those counts made by the engine (R-5.2).

## What each player knows

Owner-known fields sit on the player row (`Visibility.Policy.Owner`) or on an object that carries its own public `playerId`.

- **Hand** (R-3.1, R-5.1): `hand`, the chosen action cards not yet played, is owner-known; `handCount` is public. The set-aside cards are not stored: they are a player's eleven less the hand and the cards played. Cards played this round are public with how each was used.
- **Royal Writs** (R-4.4.4): `writs` (unsealed) and `sealedCharters` are owner-known; `writCount` and `sealedCharterCount` are public. A sealed charter stays hidden until final scoring (R-4.4.3).
- **A writ draw** (R-3.10, R-4.6.4, R-3.7.5): the writs drawn wait on the pending draw, which names its `playerId`, owner-known; the table sees how many were drawn and how many are to be kept.
- **Deck knowledge** (R-4.4.1): `deckKnowledge` keeps, owner-known, the writs a player put under the deck unseen and the slot each took. A slot is in the deck while it is at or above `top`, so knowledge needs no rewriting on a draw; an entry is dropped when its writ is drawn. `publicDeckWrits` does the same for writs the table saw go under.
- **Seals held** (R-5-H1): no one, the holder included, knows a held seal's bead value; the holder's seal count is public and its identities are in the vault.

Everything else is public (R-5.3): the map, locations, markers, pawns and their characters, vessels, monsters, landscapes and their resources, goods and shillings in every supply, the haversack counts, beads and their values, guild tracks, reeves, the purse and coffer, Knight rows, region stacks and collected tiles, wine barrels, the pouch good once finalised, the epoch, scores, the voyage and military tracks, and who is to act in every pending decision.

A defender or starved marker's owner is asked whether to answer an attack whenever public state cannot rule out an unplayed Defend: they have an unplayed card and have not played Defend this round (and, for Royal Immunity, hold a food). A player without Defend answers "no" with the same control, so being asked reveals nothing about the hand (R-3.14-H1).

## Action records

Draws, shuffles, the die and random picks are engine output. An Action that reads the vault or the protected stream resolves its result in `apply` from canonical state and writes it into state or `metadata`; the engine strips `metadata` from anything a client submits, and no submitted field is read as a draw or a roll.

| Action                                                                                                                           | Actor-known (`Policy.Actor`)                 | Public                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `FinaliseHand`                                                                                                                   | `cards`                                      | the pouch good and that the seat has finalised  |
| `Explore`, a threshold pull (`GuildAction`, `Feast`), `KeepWrits` with Shovels & Swords, `PlaceDisc` onto voyage space 2, 4 or 6 | `metadata.drawnWritIds`                      | the count drawn and the number to keep          |
| `KeepWrits`                                                                                                                      | `keep`, `metadata.returned` with their slots | the count kept and the count put under the deck |
| `DiscardWrit`                                                                                                                    | none                                         | every field: a discard is shown (R-4.4.4)       |
| `PlayMandate`, `CommitAttack`                                                                                                    | none                                         | every field: a played writ is shown             |
| `SealCharter`                                                                                                                    | `writId`                                     | that a charter was sealed                       |
| Card plays from the hand                                                                                                         | none                                         | every field: a played card is shown             |
| `ScoreGame`                                                                                                                      | none                                         | every sealed charter, revealed with its score   |

Haversack draws, the progress die and its rerolls, the hidden-bead draw, spills and every bead a flip reveals are public in `metadata`. A seal drawn from the pile onto a scroll space (Knight push, Noble pull) is named in no record; a seal flipped to a bead is named by the Action that flips it. System Actions name no writ or concealed seal.

## Undo barriers

R-X.2 stops Undo at an action that revealed information. The engine sets `revealsInfo` from what it resolved, never from input.

Always a barrier: `FinaliseHand` (a finalised hand), `Explore` (a writ draw), `Harvest` (a haversack draw), `Conquer` that asks a defender and `StarveThePeople` that asks the target's owner (a decision passed to another seat), `AnswerAttack` and `AnswerStarve` (the decision passed back), and the System Actions `RollProgressDie`, `ReplenishMap` and `ReplenishGuilds` (the die and haversack draws, and at the third dawn bead flips).

A barrier by outcome:

- `GuildAction` and `Feast`: a pull that reaches its threshold (a writ draw); the Monk trade, Farmer pull and Monk push (the hidden-bead draw); the Monk pull and Noble push (a seal flipped to a bead); a Farmer trade whose overflow spills goods picked at random (R-4.6.3);
- `KeepWrits` that turns in an iron for Shovels & Swords (a second draw);
- `PlaceDisc` that moves the voyage disc onto space 2, 4 or 6 (a writ draw);
- `PlayMandate` whose reward draws goods from the haversack or flips a bead.

Not a barrier: setup choices, card plays that draw nothing, `ForfeitCard`, `PlayDefend`, `CommitAttack` (combat is decided by public strengths once the defence is known), `KeepWrits` with no further draw, `ChooseFavours` (the goods were drawn by `Harvest`), `PlaceDisc` otherwise, `DiscardWrit`, `SealCharter`, `SpendRegionTile`, `PlaceVessel`, `ReclaimImmunitySeal`, `Nourish`, `CollectLandscapes`, and a seal drawn unseen from the pile onto a scroll space. Playing a card or a writ from a hidden hand shows it to the table but tells its player nothing new, so it is not a barrier.

## Exploration

A player or a spectator explores from their own projection. `createFromProjectedState` keeps everything the projection names: the public table, the explorer's hand, writs, sealed charters, pending writ draw and deck knowledge, and the public deck writs. It deals every other hidden value afresh from the branch's randomness, within the public constraints, each writ and seal once:

- each other player's hand: `handCount` kinds from their eleven less the kinds they have played this round;
- each other player's writs: `writCount − sealedCharterCount` writs, and their sealed charters: `sealedCharterCount` charters, from the writs the explorer cannot place (not in the explorer's hand, sealed charters or pending draw, not in the explorer's deck knowledge or the public deck writs);
- another player's pending writ draw: its count from the same unplaced writs;
- the writ deck: by slot from `top` to `nextBottom`, the explorer's deck knowledge and the public deck writs at their slots, the rest of the unplaced writs in fresh order in the remaining slots;
- concealed seals: the seals not shown as beads, dealt to the pile (by its count, in fresh order), the occupied scroll spaces, each player's held seals and sealed charters, and the immune markers.

Other players' deck knowledge is left empty, since the projection does not say what they saw. The result names no master seed and passes the canonical validator. Two sources that differ only in hidden values give the same branch.

Host View, hotseat and local branches start from canonical state through `createFromCanonicalState`, which reshuffles each hidden list within itself from the branch's new protected stream, keeping every known position: deck slots in any player's deck knowledge or the public deck writs stay where they are, and the other writs in the deck are reshuffled among the remaining slots; the seal pile is reshuffled; seals elsewhere keep their places, since no one knows them apart.

## Compatibility

No migrations: the Logic and UI Artifacts publish together, and a stored Game keeps the rules of the revision it was created under (R-X.3). Initialization sets `feudumRevision`; revision 1 is the first release, so no Game predates it. A component value corrected after release ships under a new revision, and Games created before it keep the old value. New Games use `randomnessVersion: 1`: a private master seed, with every game-rule random value from the protected stream; the seat order and starting player use the public stream when no starting positions are assigned. The visibility-capable backend and Site Frontend are prerequisites; this title adds no host bridge interface. Do not run a protected Game on a runtime without visibility registration.

## Verification

- Action schema coverage, and every registered action sampled with every optional field, projected for its actor, another seat and a spectator: `actionProjection.spec.ts`.
- Reproducible protected initialization from a master seed, and the vault, master seed and protected cursor omitted from every player's and the spectator's projection: `initializer.spec.ts`, `visibility.spec.ts`.
- Owner-known hands, writs, sealed charters, pending writ draws and deck knowledge, each projected for its owner, another player and a spectator: `visibility.spec.ts`; in Action records: `selectHand.spec.ts`, `explore.spec.ts`, `royalWrits.spec.ts`.
- Seals red side up anonymous in every projection, named on a flip, returned to the vault on favours and on Starve the People, the pile reshuffled on each return: `visibility.spec.ts`, `beads.spec.ts`, `harvest.spec.ts`.
- The defender asked whenever public state cannot rule out Defend, with the same answer available without it: `defend.spec.ts`.
- Haversack counts public and conserved, draws from the protected stream: `supply.spec.ts`.
- Guarded execution deferring every vault read and protected draw to the host, and a projection offering the same actions as canonical state for its own player: `protectedPlay.spec.ts`.
- `revealsInfo` set exactly on the barriers listed above, and Undo refused across them: each action's own spec, and `protectedPlay.spec.ts` over whole protected games.
- Exploration from each player's and a spectator's projection at states of scripted complete games (hand selection, a pending writ draw, an attack awaiting defence, a later epoch, final scoring): every writ and seal dealt once, the explorer's knowledge kept, the result complete with no master seed, the same branch from sources differing only in hidden values, and the branch playing on to the end; from canonical state, each hidden list reshuffled with every known slot kept: `exploration.spec.ts`.
- Projected history replay with forward and undo patches for every hidden-information Action, at 2 to 5 players, for every seat and a spectator: `protectedPlay.spec.ts`.
- Canonical replay and undo of a whole game through every machine state: `engineWalk.spec.ts`.
