# Game Client UI Interaction Visual Contract

This contract records shared Game Client perspective and Acting Player presentation across the dev harness and Site Frontend. Use the repository [visual-contract authoring guide](../../../docs/ui-interaction-visual-contract.md) when changing it.

## Visual intents

| Intent                           | Trigger                                                 | Observable result                                                                                                                                                                                                             | Remains unaffected                                                                                                                                |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active Player play               | Open a Local Hotseat Game in ordinary play              | The banner uses the current Player Perspective's colors, names that Player, and indicates that it is their turn                                                                                                               | Debug presentation remains independent                                                                                                            |
| Non-active Player inspection     | Enable `Non-active view` when an inactive Player exists | The first inactive Player in game order becomes the Player Perspective; player-relative presentation follows that Player, the hotseat banner shows a waiting message in their colors, and action controls are unavailable     | Local persistence, action processing, networking behavior, and the Game's hotseat status remain unchanged                                         |
| Admin Acting Player selection    | Enable Admin Mode                                       | With multiple active Players, the existing perspective remains until an active Acting Player is chosen; with one active Player, that Player is resolved synchronously                                                         | Debug presentation remains independent                                                                                                            |
| Hosted Admin control             | Enable Admin Mode in a Networked Game                   | A hotseat-style banner, colored for the current perspective when one exists, presents the Acting Player control in the center and Undo at the right                                                                           | The Game remains hosted and uses its ordinary transport and authorization behavior                                                                |
| Compact harness controls         | Reduce the dev harness below the medium viewport        | The persistent Options menu continues to contain Non-active view, Preferred colors, and Colorblind palette; Debug and Admin move from the inline navbar into that menu while retaining their current state and enabled status | The combined active-and-finished Games selector and adjacent new-game action, Player Perspective, actionability, and loaded Game remain unchanged |
| Harness conversation preview     | Load any Game in the dev harness                        | The game UI's ordinary Chat tab renders representative in-memory messages and accepts locally composed messages so its conversation presentation can be inspected                                                             | The Local Game remains Hotseat Play; production hotseat visibility, persistence, transport, and author identity rules remain unchanged            |
| Harness color preference preview | Toggle Preferred colors or Colorblind palette           | The loaded Game renders through the ordinary player-color preference and colorblind presentation paths using deterministic mock preferences                                                                                   | The Local Game remains Hotseat Play; production preference, Admin suppression, persistence, and Game State colors remain unchanged                |

The toggles and Acting Player chooser use semantic controls and retain their equivalent pointer, keyboard, focus, and touch paths.
Losing browser-window focus closes the harness Options menu, and returning to the tab does not reopen it through restored trigger focus.

## Coexistence and precedence

| Intents                                                            | Contract                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-active Player inspection with Admin Acting Player selection    | They are mutually exclusive in the dev harness. Enabling either disables the other, and disabling Admin clears its explicit Acting Player choice                                                                                                    |
| Debug with either perspective intent                               | They coexist; Debug does not change Player Perspective, Acting Player, actionability, or banner ownership                                                                                                                                           |
| Exploration with Admin Acting Player selection                     | Exploration wins perspective resolution and banner ownership. The Admin choice is dormant while Exploration uses ordinary Hotseat Play perspective rules and becomes relevant again only if still valid after returning to the Primary Game Context |
| Exploration with Non-active Player inspection                      | The non-active Player remains the Player Perspective and action controls remain unavailable; the Exploration panel retains banner ownership                                                                                                         |
| History View with either perspective intent                        | History View remains read-only. Perspective presentation follows the Displayed Game State, and no perspective intent makes historical state actionable                                                                                              |
| Compact harness controls with any perspective intent               | Responsive presentation changes only where the controls are rendered; toggle state, mutual exclusion, and perspective precedence remain unchanged                                                                                                   |
| Harness conversation preview with perspective or Admin intents     | They coexist. Locally composed mock messages are attributed to the current Player Perspective so each player-relative presentation can be inspected; production conversation author identity remains unchanged                                      |
| Harness color preference preview with perspective or Admin intents | Perspective does not change the mock preference owner. Admin retains its production suppression rules while the toggle intent remains enabled for inspection after Admin is disabled                                                                |

The Game Session owns Player Perspective, actionability, and mode precedence. For compatibility with independently deployed Game UI Artifacts, the shared Acting Player control projects its label and choices from the existing bridged perspective and active Players; other render layers do not reconstruct that presentation decision.

## Shared visual state

### Player Perspective

The Game Session supplies the Player Perspective used by player-relative labels, colors, information, and waiting presentation. Non-active Player inspection takes precedence, followed by Exploration's ordinary perspective, an explicit Admin Acting Player, ordinary Hotseat Play, and finally the Networked Play User association.

History navigation resolves the perspective against the Displayed Game State. Silent restoration and return to Live View expose only a perspective valid for the newly displayed state.

### Non-active Player inspection

The enabled preference is session-local. Its candidate is the first Player in game order absent from the Displayed Game State's active Players. The candidate is re-resolved when displayed state changes; the intent ends when no inactive candidate exists, when Admin Mode is enabled, when another Game Session is loaded, or when the client reloads.

While valid, the intent may drive Player Perspective, player-relative presentation, waiting state, banner colors, action availability, and Undo eligibility. It must not alter the Game or its persistence, processing, or transport behavior.

### Admin Acting Player choice

An explicit choice is valid only during one continuous Admin activation and while that Player remains active in the Displayed Game State. Leaving Admin Mode or publishing a state in which the Player is inactive clears it. With exactly one active Player, the effective choice is derived synchronously; with multiple active Players and no valid choice, the ordinary perspective remains and the control prompts the administrator to choose when that perspective is not active.

Exploration ignores the Admin choice. History View may display the choice but remains read-only, and navigating to a state where the chosen Player is inactive invalidates it.

### Harness conversation preview

Conversation preview availability is reported by the harness chat service when the Game Session is created. Loading a Game seeds a fresh in-memory conversation attributed to valid Players from that Game; loading another Game, clearing the service, or reloading the client replaces it. A locally composed mock message uses the current Player Perspective as its visible Player author. The preview may drive Chat-tab visibility, representative message rendering, local composition, read state, and unread presentation, but it must not create a persisted Game Conversation or invoke remote transport.

### Harness color preference preview

The harness owns two session-local preference intents, both disabled by default. Preferred colors use a valid deterministic order that prioritizes a Game-supported color other than the harness Player's assigned color when one exists. Colorblind palette uses the ordinary colorblind colorizer and game-specific colorblind presentation. Switching Games retains the toggle intents and applies a fresh preview through the new Game Session; reloading the client clears them. The preview must not change canonical Player colors or production Local Hotseat Game behavior.

## Render ownership

| Visible result                                          | Owner and boundary                                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Harness perspective and Admin toggles                   | The harness navbar owns the controls, responsive inline/menu presentation, and mutual-exclusion transitions; it does not resolve Player identity                                              |
| Local Hotseat turn, waiting, and Admin-selection banner | The hotseat panel owns the banner; it consumes Game Session perspective and Acting Player results                                                                                             |
| Hosted Admin banner and right-aligned Undo              | The Admin panel owns the banner and Undo placement; it shares the Acting Player control with the hotseat panel                                                                                |
| Acting Player label and dropdown                        | The Acting Player control owns chooser presentation. It names a Player only when the current perspective is active; otherwise it prompts for a choice or reports that no active Player exists |
| Player-relative game presentation and action controls   | Game UI components consume Game Session perspective and actionability; they do not infer Admin or non-active precedence independently                                                         |
| Banner height budget                                    | The active shell measures the complete rendered banner region and publishes the shared banner-height value; individual game tables do not guess which banner is present                       |
| Harness conversation preview                            | The existing game-owned Chat tab and chat content own presentation; the harness chat service supplies fixture state and local behavior without introducing a second preview UI                |
| Harness color preference preview                        | `GameColors` owns preview preference resolution and color mapping; harness controls supply only the two preference intents                                                                    |

## Verification scenarios

The current visual verification method is manual exercise unless a focused automated test is added.

| Scenario                                                             | Expected while active                                                                                                                                                    | Expected on exit or replacement                                                                                                   | Method                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Enable Non-active view with one active and multiple inactive Players | The first inactive Player's colors and waiting message render; new-action controls are unavailable, while Undo eligibility follows the viewed Player                     | Disabling restores ordinary active-player presentation and controls                                                               | Manual                                           |
| Inspect a Player when no Players remain active                       | The waiting presentation remains non-actionable; Undo is available only when that Player owns an eligible prior User Action                                              | Undo or leaving Non-active view follows the ordinary player-relative history rules                                                | Manual                                           |
| Advance state while inspecting a Player who becomes active           | The perspective re-resolves to the next inactive Player                                                                                                                  | If every Player becomes active, the intent turns off and its toggle disables                                                      | Manual                                           |
| Enable Admin with multiple active Players                            | Existing perspective remains; an inactive hosted perspective displays `Choose player`, while an active perspective is named accurately                                   | Choosing an active Player updates perspective and actor; disabling Admin clears the choice                                        | Manual                                           |
| Enable Admin with exactly one active Player                          | The sole active Player appears immediately without a post-render identity change                                                                                         | Disabling Admin restores ordinary perspective                                                                                     | Manual                                           |
| Enable Admin in Hotseat Play with no active Players                  | A default-colored banner renders `No active player` instead of disappearing                                                                                              | Disabling Admin returns to the ordinary no-banner state                                                                           | Manual                                           |
| Make the chosen Admin Player inactive                                | The choice becomes invalid and no inactive Player is labelled as Acting Player                                                                                           | A sole remaining active Player resolves automatically; otherwise the chooser prompts for a Player                                 | Manual                                           |
| Enter Exploration after choosing an Admin Acting Player              | Exploration uses its ordinary Hotseat Play perspective and panel; the hidden Admin choice does not affect actions or player-relative presentation                        | Returning to the Primary Game Context restores visible Admin controls and any still-valid choice                                  | Manual                                           |
| Toggle Debug during either perspective intent                        | Debug presentation changes without changing perspective, actor, banner, or actionability                                                                                 | Turning Debug off leaves the perspective intent unchanged                                                                         | Manual                                           |
| Navigate History backward and forward                                | Displayed historical state is read-only and perspective validity follows that state                                                                                      | Returning to Live View exposes only state valid for the live context                                                              | Manual                                           |
| Load another Game or reload the client                               | No non-active preference or explicit Admin Acting Player choice carries into the new Game Session                                                                        | The new session starts from its ordinary perspective rules                                                                        | Manual                                           |
| Resize the dev harness across the medium breakpoint                  | The Options menu remains available while Debug and Admin move between the inline navbar and that menu without changing their values, disabled state, or mutual exclusion | Returning to the original width restores the original presentation with the same state                                            | Manual                                           |
| Switch away from and return to the harness browser tab               | A closed Options menu remains closed even when the browser restores focus to its trigger                                                                                 | The menu still opens through its ordinary pointer and keyboard interactions                                                       | Automated browser verification                   |
| Load a Game in the dev harness and open Chat                         | Representative Player avatars, timestamps, multiline and wrapping text, and emoji render through the game's ordinary chat styling                                        | Sending appends under the current Player Perspective; loading another Game replaces the fixtures and browser reload discards them | Automated service tests; manual presentation     |
| Open a production Local Hotseat Game                                 | Chat remains hidden because Local Hotseat Games have no persisted Game Conversation                                                                                      | Hosted Game chat remains available through its existing service and transport                                                     | Manual                                           |
| Toggle Preferred colors in the dev harness                           | The harness Player receives a different supported preferred color when available and any conflict is resolved through the ordinary swap behavior                         | Disabling restores canonical Player colors; switching Games reapplies a valid preview order                                       | Automated color-model tests; manual presentation |
| Toggle Colorblind palette in the dev harness                         | Shared and game-specific colorblind presentation responds through the ordinary `GameColors` paths                                                                        | Disabling restores the Game's normal palette                                                                                      | Automated color-model tests; manual presentation |

## Maintenance

Update this contract whenever perspective intent, Acting Player precedence, shared-state lifecycle, History or Exploration behavior, render ownership, or banner composition changes. Keep Game UI artifact isolation and cross-version bridge compatibility in [ADR 0004](../../../docs/adr/0004-game-ui-host-bridge-contract.md).

## Exploration and recorded History

Ordinary projected Exploration is available when the title supplies state population. Its control is disabled with an explanatory title when that capability is absent. Authorized Debug/Admin Host View retains Exploration availability independently of projected-state population. An Acting Player inspection uses that Player's projected capability.

Starting Exploration from inside a cascade advances only a copied context through its remaining recorded System Actions, stopping before the next User Action. The displayed source does not advance or animate. Its exact return snapshot is retained across new/saved branch switches and restored with `silent-swap` on closing; failed creation leaves the source view unchanged.

Compatible source History is read-only and remains navigable in both directions through the selected source position. At that position it displays the original permitted source state. Continuing into simulated Actions uses the populated Exploration checkpoint; returning to Live restores the same hypothetical world. Existing `state-only`, `full-action`, and silent restoration intents retain their animation lifecycle and ownership.

Playable inherited Undo stops at the first forward-patched or non-optimistic cascade, or where reconstruction against the hypothetical world cannot be verified. That barrier does not disable recorded History. Exploration-generated Actions retain local Undo. Saving/loading and switching Explorations preserve each branch's sampled information, History source, and Undo eligibility.

A primary representation refresh while Exploration is open updates the primary context without replacing the Exploration's History or displayed state. Ending Exploration restores the exact original History snapshot/index when entered from History, or the latest primary state when entered from Live. A changed primary Perspective invalidates the old return snapshot, so closing uses the current permitted representation. Transient action selections continue to reset through the existing visible-state transition lifecycle.

A Game Session owns its notification subscription. Repeated listen/stop calls do not duplicate subscriptions, and disposing the Game Session stops listening even when its host has not explicitly stopped it.

Primary recovery continues during Exploration without changing the sample or its History source. A notification arriving during a representation load retains a recovery request after that representation replaces the old context. Both legacy and projected Undo wait for processing/presentation to settle before publication.

A Game UI requests hosted canonical inspection only when the injected API explicitly advertises Host View support. An older Site Frontend keeps ordinary play available and reports that a site reload is needed for Host View; a projected response cannot become the retained Host Context.

## Unavailable historical schemas

A supported current position remains playable when older projected History cannot be reconstructed. Unavailable Action records retain their public identities and indexes but have no title payload or patches. History controls stop at the newest such record; beginning, previous-turn navigation, and animated ranges cannot cross it. With no compatible recent Actions, backward navigation and playback are unavailable. New Actions extend the navigable suffix normally.

Undo cannot cross an unavailable record, including during Exploration. The backend enforces the same limit for projected Games before persistence. A replacement requiring unavailable replay uses current-state reload recovery. Existing transition animation intents and publication ownership remain unchanged.

A projected Exploration population hook receives only available source knowledge. If unavailable historical records remove facts required to construct a valid sample, the title must decline population; it must not use canonical secrets or silently ignore missing constraints. Authorized Host View can still explore its complete current state.

## Canonical Fork

The Fork control requests a real continuation from the selected primary History position. A position inside an automatic Action sequence includes its remaining consequences through the next player decision. Fork is unavailable while exploring; saved local Forks appear as Games, separately from saved Explorations. The accessible control name is `fork game`.

The host resolves Hosted Fork positions from canonical history independently of the client's projected History or Undo restrictions. Hotseat resolves from full local state and history. An unsupported position reports `This game cannot be forked from that position.` through the shared toast after the name dialog closes. The source position remains displayed. Hosted Forks enter the existing player-reservation lobby; local Forks are saved as playable Games.

## Protected harness perspectives

Protected mode is opt-in for runtimes with visibility. The navbar identifies the selected Player, Spectator, or Host View. Player views show only that Player's permitted information and allow actions only for that Player; the banner distinguishes their turn from waiting. Spectator has no player actions. Host View retains ordinary hotseat/Admin Acting Player controls.

Switching mode or perspective replaces the table and session, clears staged selections and animations through teardown, and reconstructs history from the new representation. The old table is removed while loading. The same historical index is selected where the new representation permits it; no old-perspective snapshot is restored. A failed load shows its error and offers ordinary hotseat recovery.

Protected Player/Spectator views suppress Admin authority and Non-active view. Debug remains available on projected data and cannot implicitly request Host View. Host View is an explicit selector choice. Color preferences continue to apply after replacement.

The mode and perspective selectors are unavailable while processing or exploring. Projected Exploration uses hypothetical population; Host View Exploration uses complete state. Closing Exploration restores the selected representation and its source history according to the existing Exploration contract. Canonical local persistence belongs to the harness host, while branch persistence belongs to Exploration.

## Optimistic Undo

An eligible live Undo immediately attempts reversal and simultaneous-action replay from the client's available state, including projected forward patches. The attempt is built separately and published only if it can be hydrated. Host View uses its complete displayed state; an acting-player view retains its projection. Existing reveal and Exploration Undo boundaries still determine eligibility.

The session keeps action controls blocked until the host request and visible transition settle. Undo and authoritative correction use actionless state transitions through the existing animation lifecycle, with the existing 200ms limit. Acceptance and rejection wait for an in-flight optimistic transition to settle before publishing their result. The server response is replayed from the saved pre-Undo context even when the speculative checksum matches; it replaces speculative state and history together. Host View reloads its canonical representation after acceptance. A perspective change during the request reloads the selected representation instead of applying an obsolete response.

If local replay fails, the displayed state stays unchanged while the host processes Undo. Rejection restores the prior state and invokes synchronization. A concurrent representation replacement must never be overwritten by that rollback.

Browser regression scenarios in `tests/privateHandSession.spec.ts` hold acceptance pending and verify visible reversal, retained-action ordering, equal-checksum state correction, replay failure, rejection, canonical Admin Undo of a reveal, acting-player privacy, perspective changes, queued notifications, subsequent history navigation, v2 public games, and a response arriving during an optimistic animation.

## Local hotseat Undo after the last decision

Local hotseat Undo remains available when a terminal Game State has no active
players. The local hotseat authorization rule applies before the spectator check
as well as when selecting the latest User Action. No active-player identity is
invented for a terminal state. History, information-reveal barriers, unavailable
records, and non-active-player views retain their existing restrictions. Hosted
execution and networked spectator authorization are unchanged.

The paired 18xx bankruptcy browser cases exercise this through the real Game
Session, including reload, the final System Action, and restoration of the prior
state. The fix is bundled with each newly published UI Artifact; existing UI
Artifacts retain their previous Game Session implementation. No host bridge fields
or injected capabilities change.

## Title preference controls

Game Sessions may create a typed TitlePreferences model using their injected API.
Controls optimistically update it without creating game actions. The model owns
explicit overrides, inheritance, save serialization, conflict retry, error
reporting, account changes, and disposal. Host API methods are optional so older
hosts continue to support session-local presentation choices. The ordinary dev
harness supplies localStorage persistence through the same preference contract.

## Manual camera movement

ScalingWrapper's optional `onManualViewChange` callback reports effective wheel,
zoom-button, touch-pan, pinch, and gesture changes. Programmatic focus, viewport
restoration, and resize adjustments do not report manual movement. Inspection
views can use this distinction to relinquish a saved viewport when the user takes
control of the camera.

Desktop wheel pan, wheel pinch, and Safari gesture zoom retain every input delta
and clamp the logical camera immediately, but coalesce transform writes into one
animation-frame update. Ancestor scroll handoff still receives each residual
delta, including momentum. Immediate camera changes supersede a pending render;
destruction cancels it. Touch pinch and inertia retain their existing frame loops.
This changes bundled rendering only, with no host-bridge interface change; each
consuming Game UI Artifact must be republished to adopt it, including TOP and 1889.

The camera uses a `translate3d` transform so browsers can composite the board during movement. This preserves its two-dimensional coordinates and clipping while avoiding repeated painting of masked SVG artwork during pan and zoom, especially in WebKit.

## Tab workspace

`TabWorkspace` takes stable tab definitions (`id`, `label`, optional `shortLabel`),
a content snippet receiving the tab ID and whether it is active in its own pane, and an optional bound selected tab ID.
An optional `initialSplit` supplies an axis and the tab IDs for the first pane;
remaining tabs start in the second pane, with a 50/50 divider. Without it the
workspace starts as one pane.
It owns a local binary split tree, permitting repeated splits in either direction
with a global limit of eight panes. Deleting a pane restores split capacity. Splits start at 50%, have draggable
20–80% dividers, and create empty drop targets. Each tab belongs to exactly one
pane and each nonempty pane has an active tab. Drag/drop or Alt+Shift+Left/Right
moves tabs; standard tab arrow/Home/End navigation selects within a pane. Splitter
arrow/Home/End controls resize, and cancelled pointer drags restore their ratio.

Content snippets are mounted once per stable tab ID, outside the changing split
tree; only their absolute rectangles and visibility change. This preserves DOM,
focusable content state, and embedded scaling wrappers. Inactive panels are inert.
The component exposes workspace color variables, falling back to railway theme
variables and light defaults. Tab definitions must remain stable for its lifetime.
Workspace layout survives responsive resizing; optional savedLayout restores it on remount; callers may
activate a tab by updating the bound selection. No host contract changes.

Dropping on a tab inserts before it, including reordering within the same pane;
dropping on remaining pane space appends. Every pane exposes Delete while more than one pane exists. Deletion appends its
tabs to its sibling (the first surviving leaf if that sibling is split), then
collapses the split. The selected tab remains visible.
The surviving subtree retains its contents and divider positions, and split-button
availability follows the total pane count. The last pane cannot be deleted. Pane headers are 35px high.

Native tab drops record a pending move and commit it at `dragend`, keeping the
source tab mounted through the browser's drag lifecycle. Removing it during `drop`
can suppress WebKit's drag completion and interfere with subsequent pointer input.
Mouse divider resizing uses mouse down with window-level move/up listeners;
WebKit can omit the next pointerdown after native drag/drop while still delivering
mousedown. Touch and pen resizing use pointer capture. Blur cancels resizing.

Setting `splittable={false}` provides an ordinary fixed tab bar without pane
controls or tab dragging. It is intended for an unsplit initial layout.

An optional `fixedPane` supplies a target element, label, and allowed initial tab
IDs. Its header and panels render into that target, outside the split tree; it
cannot split or close and does not consume main-pane capacity. Only its allowed
tabs can enter, while they may leave for any main pane. Empty fixed panes remain
drop targets. Content nodes stay mounted across transfers. The optional
`tabTitle` snippet adds icons or indicators before a tab label.

`onLayoutChange` emits compact v1 arrangements only when tab order, ownership,
splits or committed divider percentages change. Active-tab changes do not emit.
`workspacePersistence` bounds and normalizes untrusted layouts; unknown versions
fall back without an implicit save. `DebouncedLayout` owns five-second idle saves,
account-scoped recovery and status; `TitlePreferences.save` resolves true only on
an acknowledged persisted write, false on failure, account change or a local-only
host. The existing set/unset API and injected host interfaces remain unchanged.

Each divider offers Swap sides, exchanging whole branches (including nested
panes) while preserving their sizes. The resulting layout is saved normally.

Swap sides is hidden and does not intercept clicks until its divider is hovered
or focused. It stays visible while hovering the button and is keyboard focusable.

Pane content has an explicit stacking level above pane header/drop-target shells,
with dividers and swap controls above both. Newly inserted pane shells must never
intercept clicks intended for content moved into them.

Pane headers offer Add tab or widget. The catalog moves existing tabs without
duplicating them, and adds absent optional tabs. Fixed-pane restrictions apply.
Optional tabs are excluded from defaults and missing-tab recovery, but retained
when present in saved layouts. Operating Order is the first optional widget; in
the wide layout it replaces the Actions footer and is absent until added. The
original narrow layout retains its operating-order strip.

Pane headers consolidate splitting and adding/moving tabs into a compact options
popover anchored below an ellipsis button. Delete remains the far-right control.
The fixed pane exposes only allowed tab choices; it cannot split or close.

The options popup uses a consistent compact width, with split icons followed by
Current tabs and Add tabs sections. Add tabs is always visible when tabs can be added;
there is no separate plus button.

The Add list contains only tabs absent from every pane. Already placed tabs move
via dragging, not the catalog. Hide Add tabs when no allowed absent tabs remain;
the fixed pane needs no options button when it has no current or available tabs.

The options dropdown lists the pane’s current tabs with individual close buttons.
Actions is protected and never closeable. Closed tabs become available in Add.
An optional `closed` list in saved layouts distinguishes deliberate closures from
missing newly introduced tabs; protected tabs ignore entries in that list.

TabWorkspace is game-independent base frontend functionality. Its public catalog,
fixed-pane, initial-split, and saved-layout types are exported from the package.
Neutral workspace theme variables control all chrome, including popovers and
swap buttons; game-specific theme names never enter the base module. See
[the usage contract](tab-workspace.md). A standalone browser fixture verifies
splitting, transfer without remounting, resizing, optional tabs, and pane merging.

Callers may supply a nested initialLayout. A valid saved layout takes precedence;
invalid saved data restores this caller-defined default. DefaultTableLayout can
omit its fixed sidebar so one workspace can occupy the full available width.

A pane with exactly one tab renders its label at regular weight with no selection
underline. When another tab enters, normal selected-tab emphasis returns.

ScalingWrapper callers may gate the F shortcut with allowFullscreenShortcut,
evaluated at keypress time. isVisible reports current rendered visibility. This
does not disable fullscreen buttons or Escape handling.

ScalingWrapper fullscreen uses a manual popover in the browser top layer, escaping
ancestor stacking contexts and overflow. The same wrapper/content stay mounted;
Escape or the fullscreen control returns it to normal flow. Pane shells, content,
and dividers must never intercept pointer input intended for the expanded view.
