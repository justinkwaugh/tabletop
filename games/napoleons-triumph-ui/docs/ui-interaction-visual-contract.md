# Napoleon's Triumph UI interaction visual contract

## Visual intents

- **Board view.** The board is drawn north up, or turned a quarter so one army's side of the table is at the bottom of the screen. A wide screen opens on the viewer's own lines; a tall one opens north up. The control in the bottom right corner of the board steps through the three views. Blocks turn with the board; faces, commander flags and count badges stay upright.
- **Picking up pieces.** On their turn a player taps a corps or a group of detached units on the map. The group is ringed, a strip along the top of the board lists its units, and every place it can go is marked on the map: locales to move into (road marches in a second tint), approaches to block, and arrows for approaches it can threaten. A corps is picked up with every unit that can still move, a detached group with one. Tapping a unit in the strip leaves it out of the command or puts it back; left-out blocks are dimmed on the map. Tapping the same pieces or empty map puts them down.
- **Units already moved.** While no attack is on, a player sees a dot at the end of each of their own blocks that has moved this turn; in their command phase a commander's flag is faded once the commander has given a command.
- **Riding on.** Cavalry that has taken a locale by road and may still ride on stays picked up without being asked: its strip says it is riding on, its units cannot be left out, and the map marks only what the same command still allows, which is locales and approaches along its road and arrows for the approaches it could threaten across. Picking up other pieces and commanding them ends the ride.
- **Reinforcements.** Corps still off the map are picked up from the action area; their entry locales and road marches are then marked like any other move.
- **Battle focus.** While an attack is being fought the view closes in on the two locales and returns to where it was when the attack is over. Panning or zooming by hand cancels the return. Pieces in the two locales spread to full spacing so each block can be tapped. Every piece that has no part in the attack so far and cannot be picked for it is dimmed.
- **Naming pieces in an attack.** During the defence declaration, the feint decision, the attack declaration, the counter-attack, the loss assignment and the forced advance, the acting player taps blocks on the map or the matching tiles in the panel; both drive the same pick. A named block slides out of its stack; a leading unit slides further and carries a pointer. The attacker's pick starts from the pieces that made the threat.
- **Retreat.** Locales the retreat can reach are marked on the map and an arrow with a count shows where the units are going. Tapping a locale sends every unit there; picking one unit first, on the map or in the panel, sends only that unit. No defence roles are shown.
- **Attack marker.** The approach under attack carries an arrow from the attack locale into the defence locale for as long as the attack lasts, for both players and in History View.
- **Set-up.** While deploying, the map shows the army as it would stand if the set-up were committed now. A unit picked in the roster marks the positions it can be detached to.
- **Whole-field picking on small screens.** When pieces are picked up with the whole field in view, the view closes in on the pieces and the places they can go.
- **History View.** The action area describes the action shown and nothing on the table can be picked. The map shows the position at that step and, during an attack, the attack marker and the roles that were public then.
- **Settling.** While the session is still settling an action or an Undo, the table takes no choice: pieces are not offered for picking up or naming, and the controls of the action area and the Undo button do not respond. Nothing changes appearance for it. What was picked before stays as it is until the new position arrives.

## Coexistence and precedence

- **One Undo.** The header's Undo is the only way back; no panel has a cancel or back control. It steps back through the set-up edits while deploying, through the picks of the attack step in front of the player during an attack, and through the command being built otherwise, one manual choice at a time; with none left it undoes the last committed action. Choices the table makes by itself (the units a pick-up starts with, the riding-on selection, the attackers taken from the threat, the default retreat) are never a step of their own.
- Within an attack step Undo takes the latest stage first: a retreat being arranged is unwound before the choice to retreat, and that before the defenders picked earlier, which are still there when the player comes back to them.
- Picking up pieces is possible only in the command phase; an attack in progress replaces it, so the selection ring, order strip and move targets never coexist with battle picking.
- Retreat planning takes precedence over naming pieces: while a retreat is being arranged, blocks pick a unit to send by itself and locales are retreat targets.
- Riding on yields to any pick-up by the player; while nothing else is picked up it takes the place of the empty selection.
- Battle focus and whole-field picking cannot overlap: the second happens only in the command phase.
- Dimming for "left out of the command" applies only to the picked-up group; dimming for "no part in this attack" applies to every piece while an attack is on. The two never apply together.
- Set-up preview replaces the live position on the map only for the deploying player and only until the set-up is committed or the edits are undone.
- History View and settling both withhold every choice; History View also hides Undo and replaces the action area's content.

## Shared visual state

| State | Meaning | Producer | Consumers | Lifetime and validity |
| --- | --- | --- | --- | --- |
| Board view | How the board is turned | Table on mount (by screen shape and side), the view control | Board, piece layout, flags, battle and selection focus | Kept for the session; never reset by game state |
| Zoom | On-screen scale of the board | Board, read back from the shared scaling wrapper | Flags and markers that keep a readable size, whole-field picking | Follows the wrapper |
| Command selection | Group picked up, units left in, command kind and Guard Attack announcement | Pieces layer, order strip, action area (reinforcements) | Pieces layer, order strip, target layers, action area, header Undo | Staged selection holding only the player's own choices; reset when a new position arrives; applies only in the owner's command phase in Live View; a group or unit no longer in the position is ignored |
| Riding-on selection | The cavalry road move still open, shown as the picked-up group | Session, from the game state's road move | Pieces layer, order strip, target layers, action area | Derived; lasts while the game state holds the road move and the player has picked up nothing else |
| Threatening order | The pieces and command that made the last threat | Session, when a threat is sent | Attack steps, as their starting pick | Replaced by the next threat; ignored once the player picks by hand or when its units can no longer attack |
| Battle selections | The acting player's picks, one staged selection per attack step | Map blocks, battle panel | Battle step, header Undo | Reset when a new position arrives; each applies only while its own step is in front of the player |
| Battle step | What the acting player is deciding: who may be tapped, what each named piece is doing, the retreat as it stands with its defaults, and whether the step can be committed | Session, from the attack, the battle selections and the threatening order | Pieces layer, battle panel, target layer, attack marker layer | Derived; exists only for the acting player in Live View |
| Block marks | Whether a block can be picked, its role in the attack, and whether it is dimmed or marked as moved | Session, from the battle step, the roles already public and the command selection | Pieces layer | Derived; in History View and for the other player only public roles and the dimming remain |
| Set-up selection | The arrangements made so far, latest last, and the unit picked in the roster | Set-up panel, target layer | Pieces layer (preview), set-up panel, target layer, header Undo | Reset when a new position arrives; exists only while the viewer is deploying; Undo drops the picked unit, then one arrangement at a time |

## Render ownership

- **Dimming, picking, roles and moved marks of a block** come from the block marks alone. The pieces layer is their only renderer on the map; the battle panel shows the same roles on its tiles from the battle step and never works out dimming of its own.
- **Places to go** are one list. The target layer draws it twice around the pieces: locales and approaches to block underneath, so a block always takes the tap where the two overlap, and threat arrows on top, because they sit on approaches where blocks stand.
- **Attack marker and retreat arrows** are drawn over everything else on the board and take no taps.
- **Selection ring and commander flags** belong to the pieces layer: the ring over the blocks, the flags over the ring. Neither takes taps; a group is picked up by its blocks.
- **Empty map** puts pieces down. Blocks and targets keep their own taps from reaching it.
- **Board turning** is one transform on the board. Pieces are laid out for the turned board so stacks stay readable; flags, count badges and retreat counts turn back to stay upright.
- **Moving the view** belongs to the table alone, through the shared scaling wrapper: battle focus, its return, and whole-field picking. No layer pans or zooms.
- **Order strip** lies over the top edge of the board inside the scaling wrapper, which keeps focused views clear of it by its measured height.
- **Withholding choices while settling** is decided in the session for the map and by one disabled group around the header and action area for their controls. Styles that show a control as unavailable follow the control's own state, so a settling table does not flicker.

## Verification scenarios

Automated scenarios run in `tests/attack.spec.ts` (browser) and the specs beside the model; the rest are checked by hand in the dev harness.

| Scenario | Start | Input | Expected | After Undo, exit or replacement | Verified |
| --- | --- | --- | --- | --- | --- |
| Pick up and put down | Own command phase, nothing picked | Tap a corps | Ring, strip with every movable unit in, targets | Undo removes strip, ring and targets and undoes no action | Browser test |
| Leave a unit out | Corps picked up | Tap a unit in the strip | Unit out of the command, its block dimmed, "Detach and move" offered | Undo puts every unit back in and keeps the corps picked up; a second Undo puts it down | Browser test |
| Move and take it back | Corps picked up | Tap a marked locale | Corps stands there, strip and targets gone, moved marks on its blocks and flag | Undo returns the corps and removes the marks | Browser test; marks by hand |
| Settling | A move just undone | Pick the corps up and move it again at once | The pick-up is taken only once the pieces are offered again, and the move then happens | — | Browser test |
| Riding on | A defender has given ground to a threat made with cavalry; only the cavalry is named | Ride in by road | The cavalry stands in the vacated locale, shown picked up as "riding on" with only its road's locales, approaches and threats marked | Picking up other pieces shows theirs instead and Undo returns to the ride; with nothing else picked up, Undo takes back the ride itself | Browser test; legality in `roadAttack.spec.ts` |
| Reinforcements | A round in which a corps may enter | Tap its name in the action area | Strip for the corps, entry locales and road marches marked | Undo puts it down | By hand |
| Threat and battle focus | Pieces picked up beside the enemy | Tap a threat arrow | View closes in, attack marker on the approach, pieces spread, uninvolved pieces dimmed | When the attack ends the view returns, unless it was moved by hand | Browser test for the attack; focus and return by hand |
| Name defenders | Defence declaration | Tap a block on the map | Block slides out, its tile is marked, "Defend" becomes available | Undo slides it back and disables "Defend" | Browser test |
| Arrange a retreat | Defence declaration | Choose to retreat | Retreat targets and arrows replace defence roles | Undo returns to the declaration with earlier picks intact | Browser test; arrows by hand; order of Undo in `stagedSelections.spec.ts` |
| Retreat and occupation | Retreat arranged | Commit, then the attacker moves in | Morale falls, the attack marker and focus go, the command phase resumes | — | Browser test |
| Attack steps | Each step of an attack | Pick as the step asks | The step's roles, problems and commit state follow the picks | Changing the attackers starts the later choices over | `battleStage.spec.ts`, `retreatPlan.spec.ts`, `stagedSelections.spec.ts` |
| Set-up | Deploying | Pick a unit, give it to another corps | Roster and map preview show the new arrangement | Undo restores the previous arrangement, one edit per press; with none left Undo is not offered | By hand; order of Undo in `stagedSelections.spec.ts` |
| Board view | Any | Press the view control | Board turns a quarter; blocks turn, flags and badges stay upright | Third press returns to north up | By hand; geometry in `boardView.spec.ts` |
| Whole-field picking | Small screen, whole field in view | Pick up a corps | View closes in on the corps and its targets | — | By hand |
| History View | An attack in progress | Step back one action | Action area describes the action shown; attack marker and public roles stay; nothing can be picked; no Undo | Returning to the present restores the acting player's step | By hand; chapter grouping in `historyChapters.spec.ts` |
