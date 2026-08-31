# Game Client UI Interaction Visual Contract

This contract records shared Game Client perspective and Acting Player presentation across the dev harness and Site Frontend. Use the repository [visual-contract authoring guide](../../../docs/ui-interaction-visual-contract.md) when changing it.

## Visual intents

| Intent                        | Trigger                                                 | Observable result                                                                                                                                                                                                         | Remains unaffected                                                                                        |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Active Player play            | Open a Local Hotseat Game in ordinary play              | The banner uses the current Player Perspective's colors, names that Player, and indicates that it is their turn                                                                                                           | Debug presentation remains independent                                                                    |
| Non-active Player inspection  | Enable `Non-active view` when an inactive Player exists | The first inactive Player in game order becomes the Player Perspective; player-relative presentation follows that Player, the hotseat banner shows a waiting message in their colors, and action controls are unavailable | Local persistence, action processing, networking behavior, and the Game's hotseat status remain unchanged |
| Admin Acting Player selection | Enable Admin Mode                                       | With multiple active Players, the existing perspective remains until an active Acting Player is chosen; with one active Player, that Player is resolved synchronously                                                     | Debug presentation remains independent                                                                    |
| Hosted Admin control          | Enable Admin Mode in a Networked Game                   | A hotseat-style banner, colored for the current perspective when one exists, presents the Acting Player control in the center and Undo at the right                                                                       | The Game remains hosted and uses its ordinary transport and authorization behavior                        |

The toggles and Acting Player chooser use semantic controls and retain their equivalent pointer, keyboard, focus, and touch paths.

## Coexistence and precedence

| Intents                                                         | Contract                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-active Player inspection with Admin Acting Player selection | They are mutually exclusive in the dev harness. Enabling either disables the other, and disabling Admin clears its explicit Acting Player choice                                                                                                    |
| Debug with either perspective intent                            | They coexist; Debug does not change Player Perspective, Acting Player, actionability, or banner ownership                                                                                                                                           |
| Exploration with Admin Acting Player selection                  | Exploration wins perspective resolution and banner ownership. The Admin choice is dormant while Exploration uses ordinary Hotseat Play perspective rules and becomes relevant again only if still valid after returning to the Primary Game Context |
| Exploration with Non-active Player inspection                   | The non-active Player remains the Player Perspective and action controls remain unavailable; the Exploration panel retains banner ownership                                                                                                         |
| History View with either perspective intent                     | History View remains read-only. Perspective presentation follows the Displayed Game State, and no perspective intent makes historical state actionable                                                                                              |

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

## Render ownership

| Visible result                                          | Owner and boundary                                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Harness perspective and Admin toggles                   | The harness navbar owns the controls and their mutual-exclusion transitions; it does not resolve Player identity                                                                              |
| Local Hotseat turn, waiting, and Admin-selection banner | The hotseat panel owns the banner; it consumes Game Session perspective and Acting Player results                                                                                             |
| Hosted Admin banner and right-aligned Undo              | The Admin panel owns the banner and Undo placement; it shares the Acting Player control with the hotseat panel                                                                                |
| Acting Player label and dropdown                        | The Acting Player control owns chooser presentation. It names a Player only when the current perspective is active; otherwise it prompts for a choice or reports that no active Player exists |
| Player-relative game presentation and action controls   | Game UI components consume Game Session perspective and actionability; they do not infer Admin or non-active precedence independently                                                         |
| Banner height budget                                    | The active shell measures the complete rendered banner region and publishes the shared banner-height value; individual game tables do not guess which banner is present                       |

## Verification scenarios

The current visual verification method is manual exercise unless a focused automated test is added.

| Scenario                                                             | Expected while active                                                                                                                                | Expected on exit or replacement                                                                   | Method |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| Enable Non-active view with one active and multiple inactive Players | The first inactive Player's colors and waiting message render; new-action controls are unavailable, while Undo eligibility follows the viewed Player | Disabling restores ordinary active-player presentation and controls                               | Manual |
| Inspect a Player when no Players remain active                       | The waiting presentation remains non-actionable; Undo is available only when that Player owns an eligible prior User Action                          | Undo or leaving Non-active view follows the ordinary player-relative history rules                | Manual |
| Advance state while inspecting a Player who becomes active           | The perspective re-resolves to the next inactive Player                                                                                              | If every Player becomes active, the intent turns off and its toggle disables                      | Manual |
| Enable Admin with multiple active Players                            | Existing perspective remains; an inactive hosted perspective displays `Choose player`, while an active perspective is named accurately               | Choosing an active Player updates perspective and actor; disabling Admin clears the choice        | Manual |
| Enable Admin with exactly one active Player                          | The sole active Player appears immediately without a post-render identity change                                                                     | Disabling Admin restores ordinary perspective                                                     | Manual |
| Enable Admin in Hotseat Play with no active Players                  | A default-colored banner renders `No active player` instead of disappearing                                                                          | Disabling Admin returns to the ordinary no-banner state                                           | Manual |
| Make the chosen Admin Player inactive                                | The choice becomes invalid and no inactive Player is labelled as Acting Player                                                                       | A sole remaining active Player resolves automatically; otherwise the chooser prompts for a Player | Manual |
| Enter Exploration after choosing an Admin Acting Player              | Exploration uses its ordinary Hotseat Play perspective and panel; the hidden Admin choice does not affect actions or player-relative presentation    | Returning to the Primary Game Context restores visible Admin controls and any still-valid choice  | Manual |
| Toggle Debug during either perspective intent                        | Debug presentation changes without changing perspective, actor, banner, or actionability                                                             | Turning Debug off leaves the perspective intent unchanged                                         | Manual |
| Navigate History backward and forward                                | Displayed historical state is read-only and perspective validity follows that state                                                                  | Returning to Live View exposes only state valid for the live context                              | Manual |
| Load another Game or reload the client                               | No non-active preference or explicit Admin Acting Player choice carries into the new Game Session                                                    | The new session starts from its ordinary perspective rules                                        | Manual |

## Maintenance

Update this contract whenever perspective intent, Acting Player precedence, shared-state lifecycle, History or Exploration behavior, render ownership, or banner composition changes. Keep Game UI artifact isolation and cross-version bridge compatibility in [ADR 0004](../../../docs/adr/0004-game-ui-host-bridge-contract.md).
