# Napoleon's Triumph UI interaction visual contract

## Visual intents

- **Board view.** The board is drawn north up, or turned a quarter so one army's side of the table is at the bottom of the screen. A wide screen opens on the viewer's own lines; a tall one opens north up. The control in the bottom right corner of the board steps through the three views. Blocks turn with the board; faces, commander flags and count badges stay upright.
- **Picking up pieces.** On their turn a player taps a corps or a group of detached units on the map. The group is ringed, a strip along the top of the board lists its units, and every place it can go is marked on the map: locales to move into (road marches in a second tint), approaches to block, and arrows for approaches it can threaten. Tapping a unit in the strip leaves it out of the command or puts it back; left-out blocks are dimmed on the map. Tapping empty map puts the pieces down.
- **Units already moved.** A block that has moved this turn carries a dot at its end and its commander's flag is faded once the commander has given a command.
- **Reinforcements.** Corps still off the map are picked up from the action area; their entry locales and road marches are then marked like any other move.
- **Battle focus.** While an attack is being fought the view closes in on the two locales and returns to where it was when the attack is over. Panning or zooming by hand cancels the return. Pieces in the two locales spread to full spacing so each block can be tapped, and every piece not involved is dimmed.
- **Naming pieces in an attack.** During the defence declaration, the feint decision, the attack declaration, the counter-attack and the forced advance, the acting player taps blocks on the map or the matching tiles in the panel; both drive the same pick. A named block slides out of its stack; a leading unit slides further and carries a pointer.
- **Retreat.** Locales the retreat can reach are marked on the map and an arrow with a count shows where the units are going. Tapping a locale sends every unit there; picking one unit first, on the map or in the panel, sends only that unit.
- **Attack marker.** The approach under attack carries an arrow from the attack locale into the defence locale for as long as the attack lasts, for both players and in History View.
- **Set-up.** While deploying, the map shows the army as it would stand if the set-up were committed now. A unit picked in the roster marks the positions it can be detached to.
- **Whole-field picking on small screens.** When pieces are picked up with the whole field in view, the view closes in on the pieces and the places they can go.

## Coexistence and precedence

- Picking up pieces is possible only in the command phase; an attack in progress replaces it, so the selection ring, order strip and move targets never coexist with battle picking.
- Retreat planning takes precedence over naming pieces: while a retreat is being arranged, blocks pick a unit to send by itself and locales are retreat targets; no defence roles are shown.
- Battle focus and whole-field picking cannot overlap: the second happens only in the command phase.
- Move targets are drawn under the pieces; attack arrows and the attack marker are drawn over them, since they sit on approaches where blocks stand.
- Dimming for "left out of the command" applies only to the picked-up group; dimming for "not in this attack" applies to every piece while an attack is on. The two never apply together.
- Set-up preview replaces the live position on the map only for the deploying player and only until the set-up is committed or reset.

## Shared visual state

| State | Meaning | Producer | Consumers | Lifetime and validity |
| --- | --- | --- | --- | --- |
| `boardView` | How the board is turned | Table on mount (by screen shape and side), the view control | Board, piece layout, flags, battle and selection focus | Kept for the session; never reset by game state |
| `zoom` | On-screen scale of the board | Board, read back from the shared scaling wrapper | Flags and markers that keep a readable size, whole-field picking | Follows the wrapper |
| command selection | Group, units, command kind and Guard Attack announcement being built | Pieces layer, order strip | Pieces layer, order strip, target layers, action panel, header Undo | Staged selection (`model/selection.ts`); Undo pops the latest manual stage; cleared when a new state arrives and never applied outside the command phase or in History View |
| `plannedOrder` | The pieces that made the last threat | Session, when a threat is sent | Attack steps, as their starting pick | Replaced by the next threat; ignored once the player picks by hand or when its units can no longer attack |
| `battleDraft` | The acting player's picks for the attack step in front of them | Map blocks, battle panel | Pieces layer, battle panel, retreat arrows, target layer, header Undo | Reset by Undo while touched, and whenever a new state arrives |
| `battleStage` / `battleRoles` | Who may be tapped and what each named piece is doing | Session, from the attack and the draft | Pieces layer, battle panel | Derived; exists only for the acting player in Live View, while roles already made public are shown to everyone |
| `retreatDraft` | The retreat as it stands, completed with defaults | Session, from the draft | Battle panel, target layer, retreat arrows | Derived; exists only while the defender is arranging a retreat |
| `setupDraft` / `setupUnitId` | The set-up being edited and the unit picked in it | Set-up panel, target layer | Pieces layer (preview), set-up panel, target layer, header Undo | Cleared on commit, reset or Undo |

In History View nothing is selectable: the map shows the position and, during an attack, the attack marker and the roles that were public at that step.
