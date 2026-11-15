# Politics card interactions

## Visual intents

- **Inspect a pile:** choosing a politics pile deals its faces into the inspector's available row width. Once the deal finishes, each occurrence is an independent button, including identical cards. Pointer, touch, and keyboard activation use the same selection path.
- **Take a card:** the clicked occurrence moves to the center while the other occurrences collapse. Further selections are disabled until the action finishes or fails. The pile closes after a successful take; the hand gains one card.
- **Arm a card from hand:** Alliance and Renegade begin their existing targeting flows. Treasure adds one printed value to the pending bid or arms one payment for a wooded knight placement or for breaking an alliance. Identical faces remain interchangeable; an active badge represents one selected occurrence, not every matching copy.

## Coexistence and precedence

The deal and the interactive pile are mutually exclusive render phases. Taking is only available after the deal. The pile's pending selection suppresses repeated activation. Alliance and Renegade targeting cancel one another. Knight payment and duel bidding belong to different game phases; a duel may arm several treasures, including repeated values in development fixtures.

## Shared visual state

The selected pile occurrence is a local array index shared by the pile component and its take animator. It only selects the node to emphasize; the Action contains the card face. The index is valid against the displayed source pile and is cleared when submission settles or the animator detaches. Replay without a local selection emphasizes the first matching face.

Hovering or touch-holding a face-up card shows a magnified copy. The magnifier shares its anchor element and scale with the session, so taking that rendered occurrence transfers the enlarged view into the take animation. This reference identifies only a mounted element, never a card in game state, and clears on release or unmount. Identical faces and separate views of the same card therefore remain independent.

The deal animator derives every position from the transition. It measures the reveal's row, which sits in the same slot and at the same width as the chooser's deck row, and places both decks where the chooser draws them (`chooserDeckCenter`); the transient and interactive layouts share the same slot calculation (`buildSlotRows`). Live play, full-action replay and History navigation therefore deal from the same place, with no remembered click. Reloading into an inspection renders the cards directly after measuring.

Clicking a deck dispatches `LookAtPoliticsPile` at once. Opening a pile reveals information, so it is never applied optimistically: the cards exist only once the host has answered. The chooser holds both decks, disabled, through that wait, until the reveal reports something on screen. The opening then plays on the shared action timeline at explicit positions: the other deck fades (0-0.22 s), the chosen deck slides to slot 0 (0.22-0.6 s), and the cards fly out of it, staggered, from 0.6 s. The decks' count badges are not part of the transient copy. A hand peek supplies its click point to the session as the origin of its own splay.

Committed actions use the shared animation timeline. Actionless History navigation and Undo use the existing fast fallback, at most 200 ms; silent restoration contributes no animation. Restored inspections remain selectable. Hand keys and jitter belong to local rendering slots and never enter Game State, Action payloads, or saved History.

## Render ownership

Both pile animators and settled selection read the owner's inspection snapshot, including the `from` snapshot when taking removes it. They never read the canonical hidden pile. Opponents render one unknown card back per public hand count; no invented face enters state or history. The public final-hand snapshot supplies endgame faces. Pending opponent bids render as sealed submissions; resolved-round summaries use the complete public reveal.

The pile reveal owns both the transient deal and the settled buttons. Its animators target those nodes by local occurrence index, with the chosen node above the collapsing cards. Node maps and transient layout references clear on detach. The hand panel owns its grouped cards and active badges; the session owns targeting and pending treasure quantities.

## Verification scenarios

Browser checks use the local harness and controlled complete states:

1. Open a pile containing duplicate Alliance cards, activate the second occurrence, and verify that occurrence receives the spotlight, only one Action is submitted, and one copy moves to the hand.
2. Undo the take and navigate History backward/forward. The restored pile contains both copies and can be selected again; ordinary navigation does not play the long spotlight.
3. Replace or reload the view during an inspection. Card buttons have independent nodes and no stale disabled state or duplicate-key error remains.
4. Arm two treasures with the same value, remove one bid chip, and verify one commitment remains. Submitting sends numeric values with the correct multiplicity.

Rule tests separately verify one-copy consumption for taking, Alliance/Renegade plays, bid ownership, and forward continuation from legacy saves.

Hosted checks additionally use separate owner, opponent, and spectator accounts. Inspection faces and their history appear only for the inspector; reload preserves the snapshot, taking adds one card, Undo restores selection, and ordinary Exploration populates a complete hypothetical state. With Private money enabled, Exploration requires canonical state and Debug/Admin inspection or explicit Host View. Browser coverage verifies Host View entry, already-canonical local and unmarked hosted Games, local play and Undo, source restoration, and disabled Exploration after returning to a projection or leaving inspection.

## Private money

With Private money enabled, player panels show the owner’s balance and question marks for other balances during play. EndOfGame reveals all balances. This rendering rule also applies to complete hotseat and legacy representations; protected network projections omit other balances entirely.

Negotiation amount controls cap only publicly displayed balances or the acting player’s own balance. A demand against an opponent’s private balance has no balance-derived cap; the payer must afford any amount they personally propose or accept. Duel controls and knight/alliance costs use the acting player’s known money.

The session disables Exploration when Game configuration or the recorded state flag makes money private, unless Debug/Admin inspection or explicit Host View is active and the source uses the canonical Exploration path. Older unmarked hosted Games and ordinary local Games already have canonical state and need no separate Host View context. Debug alone in the protected harness and inspecting the acting Player's projection do not unlock Exploration. Canonical Exploration preserves balances and retains its existing card reshuffling; projected Exploration still rejects private money, including legacy Games. Public-money Exploration keeps the existing card population behavior.

# Breaking an alliance

## Visual intents

- **Alliance markers:** two small drawn hearts on every wall along an allied border. Hearts beat slowly only for a viewer who could break that alliance right now (participant, active, in a state that accepts `CancelAlliance`, holding 10 ducats); otherwise they sit still.
- **Offer:** a pink "Break alliance?" pill, in the town-name pill's style, appears just off the border after the board's hover-intent delay while the pointer rests within half a cell of any of the alliance's walls, of the corridor from the border to the pill, or over the pill's own footprint - so the pointer can travel from the hearts to the pill without the offer lapsing. Tapping or focusing the hearts arms the same offer immediately, for touch and keyboard; only an alliance's first wall is a Tab stop, so Tab goes hearts, pill, next alliance. Hovering the pill itself holds it open.
- **Break:** one click on the pill submits `CancelAlliance`; the hearts burst. The pill names how the 10 ducats are paid when it is not plain ducats: an armed Treasure first (topped up from money when worth less than 10, excess lost), otherwise ducats, otherwise the single Treasure in hand that would make the break affordable - with several such Treasures and too few ducats, the player arms one from the hand first. Once the burst has finished and the visible state has settled, the status window announces "[breaker] broke an alliance with [other] and paid 10 ducats." to every viewer until the breaker's turn passes: the breaker's own later actions do not clear it, nor do other participants' duel bids or negotiation moves while the breaker is still active; any other player's action, or the breaker leaving the active set, does.
- **Form:** playing an Alliance card is announced the same way - "[player] played an Alliance card on [other]." - once the hearts have bounced in, including when the play was auto-selected because only one target was legal. Both sentences are the history feed's own `ActionDescription`, so status and history never disagree.

## Coexistence and precedence

Only cancellable alliances are offered. When several are within radius the nearest wall wins. The pill sits above the hearts and other overlay glyphs. The offer never stages anything: `Back` has nothing to clear and `Undo` reverses the committed action as usual.

## Shared visual state

The offered alliance is local to the board: derived from the tracked pointer position, the pill's own hover, and an armed id written by tapping or focusing the hearts. The armed id is a writable derived that returns to nothing whenever `updatingVisibleState` flips, and is also cleared when focus leaves the alliance's controls or a pointer press lands outside them. Nothing about the offer enters game state or history.

The status column reserves two lines (77 px: the prompt line, the column gap, and the alliance/history line) and centres a lone line in that box, so forming or breaking an alliance never moves the board. Content taller than two lines (negotiation, duel controls, wrapped prompts, history entries, errors) grows the column at once. Below the column, the politics deck chooser and pile reveal share one slot that reserves a card row for the whole of the taker's politics turn, so the board moves once when the decks appear, stays still through the chooser-to-reveal handoff and the choice, and moves back once the taken card is away. Both containers (`ReservedHeight.svelte`) snap: an eased height would play on Undo, History navigation and silent restoration, and could not be coordinated with the deal and take animators.

## Verification scenarios

1. With a cancellable alliance, rest the pointer near its border and verify the pill appears after the delay, stays open while hovered, and breaks the alliance on click with the burst and status message.
2. Sweep the pointer across the border without resting and verify nothing appears.
3. Tab to the hearts and verify the pill appears at once and can be reached with the next Tab; tabbing away hides it.
4. As the other participant or a spectator, verify the hearts are inert and the status message still reads correctly after the break.

# Expanding a region

An expansion is committed one space at a time - one `ExpandRegion` action per space - and the engine keeps `expandingRegionId` set until the second space is taken or the knight action ends. There is no action for "that's enough", so declining the optional second space is local: the board stops offering expansion squares and any leftover sword moves on to a knight.

## Shared visual state

The decline lives in the session, because both the prompt and the board read it. It is identified by the `ExpandRegion` action that opened the expansion, not by the knight action and the region: `Undo` restores those two unchanged, so an identity built from them outlived the space it applied to and then suppressed the free second space of the expansion the player re-took. A mid-expansion `CancelAlliance` - the rulebook's ten ducats paid to free the second space - does not end the run of expansion actions that identity is read from. Nothing about the decline enters game state or history, and the spaces taken are read back from the action log rather than recorded locally.

## Verification scenarios

1. Take a first space, decline the second, then `Undo` the space: the region can be expanded again and its second space is offered again.
2. Take a first space, break the alliance blocking the second, and verify the first space stays claimed on the board and the second is still offered.

# Placing walls

While the player may place a wall, the legal edge nearest the pointer is ghosted when its centre is within one cell of the pointer, and a pointer click on the board places the legal edge nearest the click (the same capped lookup, read from the click's own position rather than hover state) - the ghost is the affordance, so the click target is not narrower than it. Keyboard activation of a square places nothing; one invisible focusable line per legal edge remains for keyboard placement. `Undo` reverses a misplaced wall as before.

# Score popups and side panels

A "+N" pill pops over the square a scoring wall completed, or over the second space of a two-space expansion with both spaces' points. The expansion total is read from the action log (the run of `ExpandRegion` actions through the closing one), never remembered by the animator. The pill (about 0.9 s) plays on the scoring action's own shared timeline, so system actions applied after it in the same batch - the `AdvanceResolution` that follows a phase-ending wall - wait for it, and full-action replay shows it too. Because the session publishes state only after the whole batch, the board draws walls and region tints from the scoring action's resulting state (`scoredBoard`) from the moment the pill mounts, and keeps following later actions of the batch until the session publishes; it is display only, and interaction reads the published state. The pill is removed when its action's timeline finishes, on a silent restoration (reported through `onSilentRestore`), and when the board unmounts; actionless transitions (Undo, state-only navigation) show none.

The session's `restoredSilently` is true when the published state came from a silent-swap restoration, which runs no state-change listener. The player panel's `animate:flip` reorder is suppressed then. The history feed suppresses its row `animate:flip` while viewing History, which covers every silent swap the History controls make. The politics hand in a player panel snaps to its new spacing.

# End-of-game score chart

Once the King is dead the end-of-game panel shows a line chart of every player's power points beside the final standings: one point after each round ends, then a last point, labelled Final, that adds the hill points scored when the King dies and the Parchment revealed at the end, so the step into Final shows what the game's last moment and the hidden cards were worth. One line per player in their colour, with a legend. Power points are public, so every Perspective sees the chart, private money included.

The points are not kept in the Game State. The Game Session works them out once, after the game ends and the complete Action History has loaded, reading the power points after each round-ending `AdvanceResolution` with Common's `RecordedHistory`. Until the history has loaded the panel shows only the standings. If any part of the history has been redacted, or cannot be stepped back through, before a round end, there is no chart.

Pointing at the chart picks the nearest point: a dashed line marks it and a dot sits on each player's line. At a round, the standings become that round's ranking, headed "After Round N" with one points column, the rows sliding to their new places over 0.2 seconds and the round's leaders in bold. At Final, or once the pointer leaves the chart, the full final table returns with Earned, Parchment and Total and the winners in bold. On a touch screen a round shows only while a finger is on the chart. The final table stays laid out, hidden, while a round is shown, so the chart beside it never moves. Below the panel's wrap width the chart sits under the table.

## Shared visual state

The hovered point is owned by the end-of-game panel and bound into its chart. It is cleared when the pointer leaves the chart and ends when the panel unmounts, which happens whenever the displayed state has no result. A round view needs the chart's history, so without one the panel shows the final table.

## Render ownership

The end-of-game panel owns the standings, the round ranking and the hovered point; the chart owns its marker and dots and reports the hovered point to the panel.

## Verification scenarios

1. Finish a game and point along the chart: the heading follows the round, the rows re-rank with the round's leaders in bold, and the chart does not shift; at Final and off the chart the final table and winners return. Manual browser verification at 1440x900 and 390x844 with the harness's Game over scenario; the history itself is covered by `scoreHistory.test.ts` and the chart's geometry by `scoreHistoryPlot.test.ts`.
2. While pointing at a round, step back through History, then return to the current state: stepping back removes the panel with its chart, and returning shows the final table with no round heading, marker or dots left over. Manual browser verification.

# Politics deck colours

Each politics deck has a colour, green for the left and blue for the right (not red, which the player colours' pink-red would blur), so a game played over days still shows who took from which deck. The colour is a soft drop shadow, like the cards' own resting shadow: it sits under the two pile counts in the summary strip, both decks in the pile chooser, the chosen deck, the fading deck and every dealt card while a pile opens, and every card you are choosing from; the opened deck's empty spot takes it as its dashed outline.

Every politics card in a hand casts a shadow in the colour of the deck it was taken from, face up or face down, yours or another player's. Your own cards are matched exactly. Another player's cards are matched by count, because the card in their take is hidden from you: each deck is certain for as many cards as it gave more than they have spent, and any card that could be from either deck casts green to its left and blue to its right. With nothing spent, their hand still holds every take in take order, so every card is certain. Once their faces are revealed at game end, a face casts one deck's colour only when it can be matched; otherwise it casts both. Hovering another player's face-down card says which deck it came from, or "Taken from the left or right deck"; on an opponent's overlapped stack the top card's count tooltip adds it. A magnified card, yours or a revealed face, carries the same words in a slim parchment band along its bottom edge; cards at their normal size carry no band, and an applied card, which does not magnify, shows none.

The decks are not kept in the Game State. The Game Session reads every `TakePoliticsCard` action once the complete Action History has loaded. A hand gains each card at its end and spends the first matching copy, so the copies of a card you still hold are always that card's latest takes, in order; a spent copy takes its deck with it and the copies left keep theirs. Until the history has loaded, or when any of it has been redacted, no card casts a colour. Your own cards are matched exactly only while every one of your takes shows its card; exploring as another player, whose takes hide their cards from you, their hand is shaded by count like anyone else's.

## Verification scenarios

1. In the harness's Politics cards from both piles scenario, the left pile count has a green shadow and the right a blue one; Bruno's Alliances cast green and his Parchment blue, and the other players' face-down cards cast green with "Taken from the left deck" on hover. Hovering Bruno's Alliance magnifies it with "Taken from the left deck" along its bottom. Manual browser verification; the matching, including cards that could be from either deck after a spend, is covered by `politicsCardPiles.test.ts`.
2. Win Crown and Scepter: the chooser's decks cast green and blue shadows, and opening one gives every dealt card its colour and outlines its empty spot. Manual browser verification.
