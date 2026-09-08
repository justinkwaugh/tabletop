# Estates rendering and interaction feedback

## Visual intents

- A settled board preserves the scene and HTML controls without submitting WebGL draws.
- Camera drag, touch rotation, zoom, and viewport resize update the board and its anchored player panels together. Rendering settles after camera motion ends.
- Hovering an eligible piece emphasizes it with bloom and, where applicable, an outline. Leaving clears the emphasis after the existing short exit delay; reentering cancels that removal.
- Player panels start above the tallest relevant row on a loaded board. The same height calculation applies during live play, Undo, history navigation, and silent restoration.
- Roof numbers always reflect the current roof, including direct jumps between roof auctions.
- Piece movement, fades, and scaling remain visible throughout action and history transitions. The auction preview rotates while shown, and legal placement cues pulse while applicable.

## Protected information

Both the portrait player cards and the anchored 3D panels show money and stolen totals only when the option, owner perspective, or final game phase permits them. Omitted balances stay absent; they never render as `$undefined` or a fabricated zero. Final scores are public. This same display rule applies to legacy Games whose canonical state still contains all balances.

Ordinary protected views have an empty roof bag with a public remaining count. The offer renders its public selectable slots. A roof appears only from the authoritative draw result; animation and label updates consume that projected state. Perspective changes replace the visible state and table through the shared harness/session lifecycle.

In Hidden Money Games, all bidders take an explicit turn. A player unable to raise sees “You can only pass”, an enabled Pass, and a disabled Bid. An auctioneer unable to buy out still confirms No; Yes is disabled. Other perspectives see the normal waiting state, without an automatic cash-based skip.

Exploration is disabled for Hidden Money Games in every perspective and phase, including legacy Games configured with the option. The control remains available for public-money Games, where hypothetical roof contents are sampled from public observations.

Adoption requires matching Estates Logic and UI publications, with versions assigned at deployment. See [visibility and compatibility](../../estates/docs/visibility.md).

## Coexistence and precedence

Camera motion, piece animation, and hover emphasis can render together. All request frames from the same board canvas; none owns an independent WebGL loop. Active visible animation takes precedence over idling. A static hover highlight does not require continuous frames.

Bidding controls are available whenever the visible game state permits bidding. Camera gestures temporarily hide them, but interrupting the auction preview cannot disable bidding. Preview movement and camera visibility fades have separate owners; resizing repositions the preview without restarting its entrance.

## Shared visual state

Postprocessing selections contain the meshes emphasized by pointer interaction. Their producers own delayed removal and cancel timers and selections when unmounted. Eligibility remains controlled by the Game Session's existing interaction rules; rendering does not grant action eligibility or change Undo, History View, or replay semantics.

## Render ownership

The board's effect composer owns the main scene render, with Threlte's automatic scene render disabled. The HUD and HTML projection tasks share the on-demand render stage. Camera controls run their update step without automatically requesting a frame; their update events request rendering when the camera changes. Player panels face the updated camera before rendering.

Threlte runs reveal callbacks inside a tracked effect. Camera fitting on reveal must exclude the debounce timer's reactive bookkeeping from that effect's dependencies.

Panel height is a projection of the visible board. Changes animate the persistent Three.js group through the shared action timeline, with a 200ms state-only fallback; silent swaps apply the derived height immediately. Preview entrance is local presentation and does not gate interaction. Its movement and visibility animations are canceled when their nodes unmount.

Reactive Threlte properties request their own frames. Imperative Three.js tweens and postprocessing selection changes explicitly invalidate the board, including final tween values and delayed highlight removal. DOM-only fades do not require WebGL draws. No change to the Site Frontend / Game UI host contract is required; adopting this behavior requires republishing the Estates UI Artifact.

## Verification scenarios

- In a seeded new game, leave the board untouched: actual draw counts remain unchanged across browser frames after loading settles. Automated browser test.
- Use an HTML action button after idling, then drag the camera repeatedly and zoom with the mouse wheel: the button commits its action, WebGL draws resume for every camera gesture, anchored HTML transforms change, and rendering returns to idle. Automated browser test.
- Resize between landscape and portrait: the scene redraws, player panels return on landscape, and each layout settles. Automated browser test.
- Hover a selectable piece, then leave: highlighting draws on entry and delayed removal, with no continuous rendering while the highlight is static. Automated browser test. Rapid reentry and teardown are also covered at the selection-owner boundary.
- Choose a piece with the mouse, use the HTML bidding buttons, complete placement, undo and replace the piece, then navigate backward and forward through history with and without animated replay: animations and HTML controls update, and states without an animated cue return to idle. Automated browser test.

- Interrupt the auction entrance with a mouse camera drag, release, and submit a bid/pass without resizing: controls recover and the preview reaches its final position. Automated browser test.
- Load a fixture with a tall completed building, resize through portrait and back, and switch directly between roof-auction states: panels start at the correct height and roof labels follow each state. Automated browser test.

- Enable Hidden Money and Protected mode, switch between owner, spectator, and Host View, and resize through both layouts: only permitted balances appear. Complete cube and roof auctions, checking the public draw label and the concealed remaining bag. Automated browser test.

- With Hidden Money and zero cash, the bidding turn remains pending across a resize, Bid is disabled, and clicking Pass advances exactly one bidder. Automated browser test.

- Hidden Money disables exploration in ordinary, player, spectator, Host View, and legacy state without the visibility flag. Public-money Games can enter and leave projected exploration. Automated browser tests.
