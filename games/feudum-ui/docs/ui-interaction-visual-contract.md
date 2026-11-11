# Feudum: the table, the map, the guilds and the panel

This contract fixes what players see and press. It follows `docs/ui-interaction-visual-contract.md`, `docs/game-ui-layout.md`, `docs/user-interactions.md` and the game UI animation skill. Rules are cited as `R-x.y` (`rules-digest.md`), house rulings as `R-x.y-Hn` and implementation rules as `R-X.n` (`rulings.md`), in `games/feudum/docs/`. Hidden information follows `games/feudum/docs/visibility.md`. Action, machine-state and component names are the engine's (`components.md` ids).

Its code and tests are the source of truth: where this file and they differ, they win and this file is corrected in the same change.

## The principle

Oath's principle, with three stated departures:

1. **The table is for looking.** A press on a card, a writ, a region tile, a guild area, a seat or a stack shows it at a readable size or opens what the table knows of it. That press changes nothing in the game.
2. **A press enlarges.** The enlarged view sits over everything until the next press, Escape or its close button.
3. **The panel chooses.** Every choice with no place on the board is a row or a button in the action panel: a card, a mode, a writ, a good, a count, yes or no.
4. **Departure: a lit thing on the map is picked on the map.** `docs/game-ui-layout.md` binds this: players act where the thing is. A space, a piece, a marker, a landscape, a region stack or a guild area is picked by pressing it, but only while it is lit. An unlit element does nothing on a press except enlarge, as in 1. The reason: nearly every Feudum card targets one of 22 spaces or the pieces on them, and a list of those in the panel would not show where they are.
5. **Departure: the guild bench is an enlarged view that chooses.** A guild function moves goods, seals, beads and markers between two guild areas (R-4.6). Those grids (a 5 × 4 market, six scroll spaces, four Knight rows of six spaces) are too small to press at any fitted scale, and two of the six neighbouring pairs (Alchemist → Knight, Monk → Farmer) lie on opposite edges of the board. So once a guild function is staged, the two areas it touches are drawn side by side at a readable size in the **guild bench**, and the function's picks are made there. The bench draws the same components as the board; it is the board's own guild areas enlarged, never a second picture.
6. **Departure: the hand is chosen by pressing the card.** In hand selection and in card play the action panel shows the seat's cards as card faces, and a press on a card picks it. Each card carries a magnifier at its corner that enlarges it and picks nothing. The reason: the hand is the panel's choice (3), and a face is the clearest row for it.

## The table

### What is on it

The board keeps the printed board's arrangement: the map in the centre, three guild areas down each side, the tracks round and under the map. Players moving between the physical game and this one find each thing where it was. Where the print is supplied it is the ground: the map, the score ring and frame, and each guild's panel, with state, hit targets and picks fitted over it; each is drawn in code where its file is absent.

- **The printed guild panels** are the guild areas' ground at board scale and on the bench. The pieces stand on the panel's printed spaces, and the bench's presses cover those spaces. A Knight row's column is narrower than a finger at bench scale, so a row that takes a press reaches past its print to 44 px across, as far as a pressing neighbour allows; its ring stays over the printed column (S68). The area draws only what the print can't show: the pieces, the veil on an apprentice space below its player count, and the counts (purse, coffer, rosary total, barn against its limit). A concealed seal stays a crowned back on its printed scroll.

| Region of the table                                     | Holds                                                                                                                                                                                                                                                                                                                                                                                                        | Drawn as  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| **Map** (centre)                                        | 6 regions, 22 spaces (`space.<region>.<n>`) with their N/S/E/W letters, the six starting spaces, the routes of five media (road, ship, submersible, flying machine, ferry); on each space its location disc, influence markers as ruler, serf and subject, an immunity seal under a marker, a landscape tile with its resources, goods, abandoned vessels, pawns with their characters and vessels, monsters | from data |
| **West guilds** (left edge, top to bottom)              | Alchemist (carts and piles, vessels for sale), Merchant (market 5 bins × 4 spaces with prices), Farmer (barn, 4 chickens, purse); each with its three-space track (master, journeyman, apprentice), ranks' markers and reeves                                                                                                                                                                                | from data |
| **East guilds** (right edge, top to bottom)             | Knight (one row per colour in use, three barrel sections, monster icons), Noble (six scroll spaces in rows of 3, 2, 1), Monk (rosary, coffer); each with its track                                                                                                                                                                                                                                           | from data |
| **Epoch sky** (above the map)                           | the five sunrays I–V with each dawn's map direction, catapult and refill marks; the epoch marker                                                                                                                                                                                                                                                                                                             | from data |
| **Region stacks** (below the map)                       | six stacks, top tile face up with its epoch, count, and the printed V under an empty one; the region tile chart (R-4.3.2); the progress die beside them                                                                                                                                                                                                                                                      | from data |
| **Voyage and service**                                  | the epic voyage track (7 spaces to the monastery, writ icons on 2, 4, 6) with each seat's disc; the military service track (3 spaces, −3/−4/−5) with each seat's discs (R-4.9)                                                                                                                                                                                                                               | from data |
| **Barrels**                                             | one wine barrel per seat colour, 0–3 sulfur (R-4.10.2)                                                                                                                                                                                                                                                                                                                                                       | from data |
| **Score ring**                                          | the 0–149 track round the board's edge; each seat's scoring disc; a score of 150 or more shows a "+150" chip on the disc                                                                                                                                                                                                                                                                                     | from data |
| **Margin** (below the board, inside the scaled surface) | the writ deck (count; writs the table saw go under, as a "seen" note), the haversack (counts by good), the general supply counts that bind play (seals in the pile, vessels, influence per colour, targets, discs), the start-player marker                                                                                                                                                                  | from data |
| **Players column** (the sidebar's Players tab, desktop) | one seat panel per seat, in turn order from the starting player                                                                                                                                                                                                                                                                                                                                              | from data |
| **Seat strip** (phone)                                  | one chip per seat                                                                                                                                                                                                                                                                                                                                                                                            | from data |

### Drawn in code

A piece, face or disc the publisher's art supplies shows it through the asset map, and draws its own labelled fallback when the file is absent (`art-plan.md`, "Supplied assets"). Everything else, and anything that takes a seat colour but was not printed in the colour the seat shows, is SVG generated from data. The fonts are OFL. The forms below are the drawn ones.

- **Geometry from data.** Every space, route, guild grid space, track space, stack and barrel has a position in one board geometry table in board units; routes are drawn along stored control points. A spec checks that every id in the logic's board data has a position and no position names an id the data lacks. Nothing is measured from a picture at run time.
- **Terrain.** Each region is a filled shape in its terrain token (sea, island, forest, desert, badlands, mountain) with a light hatching motif per terrain (waves, hills, trees, dunes, cracked earth, peaks) drawn once in a `<defs>` and repeated.
- **Routes.** Each medium has its own line and glyph so none is told apart by colour alone: road a solid tan path; ship a dotted line with a small sail glyph at its midpoint; submersible a dash-dot line with a periscope glyph; flying machine a dotted arc lifted off the ground with a wing glyph; ferry a rope-dashed line with a ferry glyph and the "2s" fare. Where two media join the same pair of spaces their lines run side by side.
- **Spaces.** A location disc shows its kind as a silhouette (outpost tower, farm field, town roofs, feudum keep) and a feudum its guild icon (sheep, coins, gear, axe, crown, cross). A starting space wears a double ring in map ink. Influence markers stand on the disc: the ruler on top, a subject beside it in the same colour, a serf below in the other colour, an immunity seal as a small crowned red disc under its marker.
- **Pawns and pieces.** A pawn is a figure in the seat colour carrying its character's icon on its chest; a pawn on a vessel stands on the vessel's hull. A drunk pawn tilts and carries a small sulfur drop. Monsters are their own silhouettes (behemoth, sea serpent) with a seat-colour collar when controlled. An influence marker, a player disc and a reeve are the printed wooden pieces while the seat shows one of the five printed colours and the file is present (a disc its blank face, a reeve the face printed with its point), each still carrying the seat's initial; otherwise they are drawn in the seat colour. Pawns are always drawn, since the print does not show a pawn's character. Up to four pieces sit round a space at fixed slots; more show as a count chip.
- **Goods.** Each good has a silhouette as well as its colour: saltpeter a white crystal, sulfur a yellow nugget, iron a dark ingot, wood a brown log, food a green sheaf. Goods on a space or in a grid show one token per good up to four, then a token with a count.
- **Tokens in text.** A good, shilling, seal, bead, vp or vessel named in a panel or a history line is drawn as its symbol, so the table and the sentences share one vocabulary.
- **Card, writ and tile faces** are components that lay out their data (below). Enlarging shows the same component at a larger size.

### Seat panel

Each seat has one **seat panel**. On a desktop the seat panels stand in the Players tab and nowhere else; on a phone the seat strip stands in for them, and a chip opens the full panel as a sheet. Every view of a seat reads one derivation of it, so they never differ.

The panel's look is the game's signature (`docs/game-ui-layout.md`): a **sealed charter roll**, a parchment sheet hung from a wooden roller, the seat colour as its ribbon and wax seal. Top to bottom:

- **Ribbon:** the name in the seat colour, the score, the turn-order numeral, the start-player crown when the seat holds the marker, and the turn pulse while the seat decides.
- **Cards:** the eleven action cards as small faces in a fixed order (R-3.5). Played cards stand face up in play order, each marked with how it was used (regular, special, forfeited, replayed, Déjà Vu, flipped as Defend). For other seats the unplayed hand is a stack of card backs with its count; the set-aside cards are not shown, since which they are is hidden. The owner sees the hand's faces, and the set-aside cards dimmed.
- **Pouch:** the pouch good once finalised (saltpeter "extra action" or sulfur "sequential", marked spent once used); before it is finalised, "choosing" for others and the drafted good for the owner.
- **Supply:** goods by kind, shillings, influence markers in supply, free discs (of 3, R-1.1), vessels by type, collected region tiles (each a small face), beads with their values, concealed seals as crowned red discs with a count.
- **Writs:** the writ count as backs; once final scoring seals them, sealed charters as backs with a wax seal (R-4.4.3). The owner sees unsealed writs' faces, and sealed charters' faces dimmed with "sealed". A note "you know 2 under the deck" shows the owner's deck knowledge.
- **Wine barrel:** 0–3 sulfur.
- **Guild standing:** six crests in ring order (Farmer, Merchant, Alchemist, Knight, Noble, Monk), each with the seat's stars (primary + secondary), its rank badge (M, J, A) when on the track, and a reeve dot. A crest with stars but no marker in supply shows "no marker" (R-4.5.2); one whose seat holds markers but is outranked off a full track shows "outranked" (R-4.5.3, R-1.4.9).
- **Service and voyage:** military discs covered (of 3), "vassal" when the seat rules a feudum, the voyage space.

Rules for the panel:

- **Enlarge.** A press on any card, writ face, writ back, tile or bead in a seat panel enlarges it in the centre until the next press or Escape. A back enlarges as a back.
- **Open a seat.** The ribbon opens that seat at a readable size over the table: the same panel, larger. The backdrop, Escape or the ribbon closes it.

### Cards, writs and tiles

- **Action card face:** while the seat shows one of the five printed colours and its file is present, the whole printed card in that colour, with the card's number on the border's foot and, at the compact size only, its short name again over the print's foot (at standard and full sizes the print names the card, and its accessible name does too); its back is the printed back in that colour, the same for every face. Otherwise the seat colour as a band round an art window, with the supplied art when its file is present; drawn, parchment with the card's name and number, its symbols in the top-right corner (x2, crossed x2, not-last, either/or, vp), the regular action in one line, the special ability's name with its need as an icon (a pawn character, a good, a barrel sulfur). The back is the seat colour with a crown.
- **Writ face:** a mandate shows its two alternatives as two rows, A and B, each with the goods it turns in boxed and its reward in tokens; mandates 6 and 8 show their three guild rewards each under its guild icon and "3★". A charter shows its name, its values, and for a kingdom charter a small map of the board with its qualifying spaces dotted. The back is a crowned writ.
- **Region tile:** front shows the region and the epoch numeral; back (as a landscape) shows the landscape kind (orchard, silver mine, archery butt, sulfur mine) and its resource.
- **Seal and bead:** a seal is a red disc with a crown, the same for everyone; a bead is a pale disc with its value "+3".

## Visual intents

### Pick conventions

- **Lit** (amber ring): a target the deciding seat may press now. The rest of the map dims while a map pick is open. Panel-only steps never dim the map.
- **Picked** (heavier amber ring): a staged pick. Pressing it again unpicks it.
- **Halo.** Every ring, outline and chip is drawn over a dark halo, so a seat colour, a terrain or a red seal never stands in for it.
- **Chip:** a short note on a lit target: a cost ("1 wood", "2s"), a gain ("+3 vp"), a consequence ("starve", "pinned") or a role ("ruler", "off"). It is anchored on its target and never covers another lit target. Rose chips carry a cost or a threat and always carry a label and a halo; amber chips carry what is yours to take.
- **Being decided** (neutral dashed outline, no dimming): what the deciding seat is choosing among, shown to every other seat and in History View, wherever it is public.
- **A lone legal choice** is auto-selected (`auto` stage). Undo never returns to it, and an auto selection never completes a send: the send is always a press.
- **Dimmed with a reason.** A card, function or button the engine refuses in the displayed state is dimmed; a press on it gives the reason in one line ("Conquer can't be your last card: forfeit it.", "No farm under 10 goods."). A dimmed map element does nothing.

### Confirming a send that cannot be undone

A press that completes an undoable Action sends at once. A step whose Action will set `revealsInfo` (R-X.2) stages instead: the panel shows one primary button naming the Action with "can't be undone". Those are: `FinaliseHand`; `Explore`; `Harvest`; an `Improve` that takes a tile (its landscape was hidden, R-1.4-H2); a `Conquer` or `StarveThePeople` that asks the target's owner; `AnswerAttack`; `AnswerStarve`; a `GuildAction` or `Feast` whose preview reaches a pull threshold, uses the hidden-bead draw (Monk trade, Farmer pull, Monk push), flips a seal (Monk pull, Noble push) or spills at random (a Farmer trade over the barn's limit with beads on the chickens); `KeepWrits` with Shovels & Swords; `PlaceDisc` onto voyage space 2, 4 or 6; a `PlayMandate` that draws goods or flips a bead. Which of these will reveal comes from the logic package's preview of the staged input, never from the UI's own reading of the rules (see [What the model supplies](#what-the-model-supplies)).

### Setup

- **`ChooseStartingGoods`** (R-1.4.8). The setup seat's panel shows the five goods with the haversack's count of each. Presses pick three different goods (tap list); a good the haversack lacks is dimmed. When sulfur is picked a popup beside it asks "To supply" or "To barrel". The primary button reads "Take saltpeter, sulfur (barrel), iron". Others see "‹Name› chooses starting goods" and the haversack counts.
- **`PlaceStartingPawn`** (R-1.4.9). The panel shows the six character faces, each with the rank it would give now ("master", "journeyman", "apprentice", "no rank" from the guild tracks, R-4.5). A press picks a character; the six starting spaces light on the map. A press on a lit space sends. Picking the space first is equally allowed: either order, Undo steps back one press. Others see the starting spaces outlined as being decided.

### Hand selection (`SelectingHands`)

- **Drafting.** Every seat drafts at once, locally (R-3.1, R-3.1-H1). The panel shows the seat's eleven cards in two rows (six, five). A press toggles a card in or out of the hand; the hand's count reads "4 of 4" ("5 of 5" with saltpeter). Below them, the pouch row: "No pouch", "Saltpeter: 5 cards" and "Sulfur: two cards back to back", each dimmed when the seat's supply lacks it (barrel sulfur never counts, R-3.3). Choosing saltpeter makes the count 5; dropping it with five cards picked leaves the hand at five, over, until one is dropped.
- **Conquer warning** (R-3.13-H1). A hand with Conquer where every other card could be played before it, so that it may end last, carries the line "Conquer may end up your last card; it would be forfeited." It is a warning, not a refusal.
- **Finalise order.** Every seat sees the finalise row at the top of the action area: seats in turn order, a tick and the pouch good on each that has finalised, a mark on the next finaliser. The next finaliser's primary button reads "Long live the king · can't be undone", enabled once the hand count is exact. Every other seat's draft stays editable, and its primary reads "Waiting for ‹Name› to finalise". The row is what lets a seat wait to see an earlier pouch good (R-3.1).
- **At-will before finalising.** The next finaliser's panel also offers the at-will row (below) (R-4.4-H1).
- **Send.** The finalised cards leave the panel; the seat panel shows the hand as backs to others and the pouch good to all.

### Playing a card (`PlayingCards`)

The turn player's panel shows the hand as faces in one row. Above it, one line: "Epoch II · Round 4 · your 2nd card of 4". Below it, the at-will row. Other seats see the turn player's hand as backs.

- **Stage 1, the card.** A press picks a card. The panel then shows the card's modes as buttons:
    - its regular action ("Move");
    - its special ability, when the seat meets its need (R-3.4): "Godspeed" as a toggle on an additive card, or a separate button on an either/or card ("Tend Landscape · 1 wood");
    - "Forfeit", which plays the card without its action (R-3.2);
    - "Play two cards this turn" as a toggle, while the pouch holds an unused sulfur (R-3.3). With it on, the turn continues with a second card after the first and its follow-ups.
- A card the engine refuses in every mode except Forfeit shows only Forfeit. A lone Conquer shows only Forfeit (R-3.13-H1).
- **Reinforcements is asked** (R-3.12-H1): with a Knight pawn on the board and a marker to come, Tax shows two rows, "Collect Reinforcements · +1 marker" and "Decline Reinforcements". The button reads "Tax · +4s", dimmed until a row is picked, then says the answer: "Tax · +4s · Reinforcements +1 marker". The engine reads no choice from the UI that the seat did not make (R-X.1).
- Undo steps back through the stages one press at a time, then to no card picked.

Card by card, the stages after the card and its mode:

- **`Migrate`** (R-3.6). The seat's pawns in supply show in the panel as figures; its pawns on the map light with an "off" chip. A press on a supply pawn lights the legal spaces (a space with the seat's pawn or marker, or a starting space when it has neither), each with "1 food" in rose; with Distant Kin on, every starting space lights with a "Distant Kin" chip. A press on a lit space opens a popup beside it with the six characters, each with the rank it would give. A character press sends. A press on a map pawn with "off" sends.
- **`Move`** (R-3.7, R-4.2). Described under [Move](#move).
- **`Influence`** (R-3.8). One press sends, unless a choice is open:
    - **Money is Influence** (R-3.8.3): each space where the seat's Merchant stands under an opponent's single ruling marker lights with "Money is Influence · 1s" in rose. A press picks it. The primary reads "Influence · Money is Influence at Desert 4" or "Influence".
    - **Markers run short** (R-1.1): the spaces holding the seat's pawns light; the panel reads "Place 2 of 3"; presses pick that many; the primary is enabled at the exact count.
- **`Improve`** (R-3.9). Ruled locations that can be improved light, each with its step and cost ("→ town · 1 iron" in rose). A press picks one. Town → feudum opens a popup beside it with six guild icons. When the candidate discs differ in their other face, a second popup offers the faces; otherwise the disc is taken for the seat. When the region's tile is prohibited (R-4.3-H1) the region stacks with an earlier-epoch tile on top light, each with "no vp"; the panel reads "The Desert tile is not yet legal: take an earlier tile". A prohibited tile is said on the chip ("no tile" or "earlier tile · no vp") and in the panel line before the press. The last press sends, or stages for the primary when it takes a tile. The chip on the space shows the tile and points it will give ("tile · +4 vp").
- **`TendLandscape`** (R-3.9.3, the Improve card's special). The seat's collected tiles show in the panel by their landscape. A press picks one; spaces where the seat is serf and no landscape lies light. A press on one opens a popup: "Collect 3 food · 1 to the ruler" or "Leave it". Its press sends.
- **`Explore`** (R-3.10). The primary reads "Explore: draw 3 writs · can't be undone". Then `KeepingWrits` follows.
- **`Harvest`** (R-3.11). Ruled farms under 10 goods light, each with its total ("7 goods"). A press opens a popup beside the farm: "Harvest 7", "Favours: 5 here, 2 to you", with "your 2 beads turn to seals" in rose when the seat holds beads, and, with a Farmer pawn on the board, "Inspect the harvest". The choice stages; the primary reads "Harvest 7 at Forest 3 · can't be undone". Inspect leads to `InspectingHarvest`.
- **`Tax`** (R-3.12). One press sends; with Reinforcements to collect, a row answers it first (R-3.12-H1).
- **`Conquer`** (R-3.13, R-4.8). Opponents' pawns, monsters and feudums on spaces where the seat has a pawn or monster light, each with the strengths as known now ("3 vs 4") in rose. Pieces of one owner on one space are picked one by one; a feudum is picked by its disc. The panel shows the tally (attack and defence by source) and "Defence may rise by 1 if they answer". When the engine will ask the defender, the primary reads "Conquer Ana's knight · Ana may answer · can't be undone"; otherwise the press sends and leads to `CommittingAttack`, or resolves when there is nothing to add.
- **`StarveThePeople`** (R-3.13.2, the Conquer card's special). Opponents' subjects and serfs on spaces holding the seat's Noble light with "starve" in rose; an immune marker is unlit and carries its seal. When the engine will ask the owner, the primary reads "Starve Ana's serf · Ana may answer · can't be undone"; otherwise the press sends.
- **`PlayDefend`** (R-3.14.1). One press sends: "Play Defend · +1 vp".
- **Repeat** (R-3.15). The card's stage shows this round's played cards. Those carrying x2 light; with a saltpeter in supply the others light too, except Conquer and Defend, each with "Déjà Vu · 1 saltpeter" in rose. A press picks the card to replay; that card's stages follow, and its Action carries the repeat.
- **`GuildAction`** (R-3.16). Described under [Guild and Feast](#guild-and-feast).
- **`Feast`** (R-3.16.3, the Guild card's special). Described under [Guild and Feast](#guild-and-feast).
- **`ForfeitCard`** (R-3.2). Its press sends.

With "Play two cards this turn" on, the first card's Action carries the declaration; after it and its follow-ups the panel shows the hand again with "Your second card" and no Forfeit-only restriction beyond the rules.

### Move

A Move is many presses and one Action (R-3.7, R-4.2, R-4.2.4). Its stages: steps (a stacked stage), Godspeed, pilfer, then the primary button.

- **Allowance.** The panel reads "Moves left: 3 of 4" (pawns on the board plus monsters, R-3.7.1).
- **Pieces.** The seat's pawns and monsters that can take a step light. A pinned pawn (an opponent's monster on its space, R-4.2.4) is unlit and carries "pinned". A press picks a piece.
- **Steps.** The picked piece's next spaces light, one chip each naming the way: a road glyph, "ship", "board the ship", "place your ship", "ferry · 2s" in rose. Ferries light only while no vessel is for sale (R-4.2.3). When one way reaches the space, a press on it is the step. When several do (a road and a flying machine; a ship and a submersible; placing a ship or boarding the one here), the press opens a popup beside the space with the ways; a way's press is the step. A vessel left on the space this turn is not offered to board (R-4.2-H2).
- **Trail.** Each step draws an amber trail from the piece's start, numbered in press order, and the piece is shown at its new place with a faint ghost at its start. The piece stays picked, so the next step lights from where it now stands. Pressing another lit piece picks it instead.
- **Undo** takes back the last step, then the one before; the allowance count rises with each.
- **Done.** "Stop moving" ends the steps. When the allowance reaches 0 the steps end by themselves.
- **Godspeed** (R-3.7.3), with a Monk pawn on the board: the seat's monks light and the panel offers "No Godspeed". A monk press lights its next spaces as a step does; a space press stages the extra step, drawn as a trail in a lighter amber.
- **Pilfer** (R-3.7.4): each piece that moved and stands where it may take a resource shows its resources as small chips on the space (each good kind there, the farm's harvest, a landscape's good, target or shilling). Resources it may not take (a farm the seat rules, a landscape the seat's serf tends) are not shown. A press picks one; "No pilfer" is offered.
- **Send.** The primary button reads "Move · 3 steps · pilfer 1 iron". A Move is sent by this button because it has no last forced press. It is undoable.
- **Second successful move.** When the Action is the round's second successful move for the seat, a voyage follow-up follows (`PlacingDisc`).

### Guild and Feast

- **Stage 1, the guild** (`GuildAction`). The guild areas the seat may use light on the board: a guild not used this round (R-3.16.2) with at least one function the seat may perform. A press on a lit area opens a popup beside it with its functions: "Trade", "Pull" (journeyman) and "Push" (master), each dimmed with its reason when not open to the seat, each with its cost in rose and its best outcome ("Push · up to 6 vp"). A function press opens the bench.
- **Feast** (R-3.16.3). Spaces where the seat has a pawn and an opponent has a pawn or feudum light with "feast · 1 barrel sulfur" in rose. A press opens a popup beside the space listing each opponent there with their function in each guild they hold a rank in ("Ana · Merchant push"), dimmed where nothing could move. A press opens the bench. The bench's result line names "+3 vp feast" and the share taken; no reeve is offered.
- **The bench.** The two guild areas the function touches stand side by side, from-guild left, to-guild right (a trade shows its one guild). It sits over the board area, above the scaled board and below the action panel; the panel keeps its line and its primary button. The bench lights the items the function may move, takes presses, shows each picked item at its destination as a ghost, and keeps one result line: items moved, rows, columns, carts or thresholds completed, points, the payment's split ("1s to Ana, 1s to Ben, 1s to the coffer"), and reeve points. Every value on the result line comes from the logic package's preview of the staged input.
- **Count.** Where the function scores rows or columns (Merchant pull, Farmer push, Noble pull, Knight push), and both are completed, a toggle "Rows (1)" or "Columns (2)" sits on the result line; the higher is preselected as an auto stage.
- **Fewer than stated** (R-4.6-H5). The panel reads "Move up to 3"; the primary is enabled from the first item and names the count.

Picks per guild and function (R-4.6):

| Guild     | Trade                                                                                                                                                                             | Pull (from the guild before)                                                                                    | Push (to the guild after)                                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Farmer    | map pick: ruled farms with goods light; a popup splits the goods sent into food and shillings ("4 sent: 2 food / 0s")                                                             | bench: Monk rosary → Farmer chickens; nothing to pick; "Draw a bead · can't be undone"                          | bench: Farmer barn → Merchant market; press barn goods by kind, up to 5, each landing in its bin's next space; count toggle; the purse split shows                                       |
| Merchant  | bench: press a bin to buy its cheapest good, up to 3 presses; each press shows its price in rose                                                                                  | bench: Farmer barn → Merchant market; up to 3 goods by kind; count toggle                                       | bench: Merchant market → Alchemist carts and piles; up to 4 goods by kind                                                                                                                |
| Alchemist | bench: press a vessel for sale, "3s"                                                                                                                                              | bench: Merchant market → Alchemist carts; up to 2 goods by kind                                                 | bench: Alchemist carts → Knight rows and the vessel space; inventions as buttons with their recipes (ship, submersible, flying machine, krud barrel with this push's price), 1–3 presses |
| Knight    | bench: the seat's row, "3s: take 2 markers"; with 3 or more, a popup "Tame the behemoth", "Tame the sea serpent" or "No"; a tame then lights the map spaces it may be deployed to | bench: Alchemist carts → Knight; one invention as a button                                                      | bench: Knight rows → Noble scrolls; press 1–3 rows of different colours, then as many empty scroll spaces; count toggle                                                                  |
| Noble     | bench: press 1 or 2 seals on the scrolls (R-4.6-H1), "3s" each                                                                                                                    | bench: Knight rows → Noble scrolls; press 2 rows of different colours, then 2 empty scroll spaces; count toggle | bench: Noble scrolls → Monk rosary; press 2 seals; "Flip 2 seals · can't be undone"                                                                                                      |
| Monk      | bench: the rosary's high and low beads lit as the draw's two candidates, "3s"; "Draw a bead · can't be undone"                                                                    | bench: Noble scrolls → Monk rosary; press 1 seal; "Flip it · can't be undone"                                   | bench: Monk rosary → Farmer chickens; nothing to pick; "Draw a bead · can't be undone"; the coffer split shows                                                                           |

- **Payment short.** When a guild price or a turn-in good is short and the seat holds a region tile, the primary is replaced by "Cover with a tile": a popup lists the seat's tiles; a tile press then a good press covers it, as one more stage (R-4.4-H1). Shillings cannot be covered.

### Follow-ups

- **`KeepingWrits`** (R-4.4.1). With no iron and a tile to bring one, Shovels & Swords is still offered and names the tile it spends by region and epoch, "Keep, then Shovels & Swords · Desert I tile for iron · draw 2 more" (`wildTileNeeded`, R-4.3-H3); Royal Immunity names its tile the same way. The drawer's panel shows the drawn writs as faces with magnifiers and "Keep 1 of 3". Presses pick (tap list). The primary reads "Keep 1 · 2 under the deck". After an Explore, with an iron in supply and Shovels & Swords not yet used, a second button reads "Keep, then Shovels & Swords · 1 iron · draw 2 more · can't be undone". Others see the drawn count as backs, "keeps 1".
- **`InspectingHarvest`** (R-3.11.3). The panel shows the drawn goods in a row and "Take 2 as favours". Presses pick goods (tap list); "No favours" sends null. The primary is enabled at the chart's count.
- **`CommittingAttack`** (R-4.8). The attacker's panel shows the tally: attack by source (pieces, saltpeter, weapons, serf) and defence (pieces, feudum, subject, Defend if flipped). A saltpeter stepper (0–1, or any count with an attacking knight). The seat's weapon writs (mandates 1 and 3) show as faces, each with its two alternatives as buttons; a turn-in short of a good offers the tile cover. The primary reads "Attack 5 vs 4: wins · +2 vp" or "Attack 3 vs 4: fails". Undoable.
- **`PlacingDisc`** (R-4.7, R-4.9, R-4.9-H1, R-3.7.5). One question in the panel with the discs left ("Free discs: 2 of 3"): "Place a reeve in the Merchant Guild?", "Place a military service disc?" (with the space and the penalty it covers), "Place your voyage disc on space 1?" or "Advance to 4? draws 2 writs · can't be undone". Two buttons: the placement and "Keep the disc". The place or space the disc would go to is lit on the board.
- **`DiscardingWrits`** (R-4.4.4, R-4.4-H9). It opens whenever a step leaves a seat over the limit, on its turn or not, and asks one seat at a time. The holder's panel reads "Hold at most 3 writs: 4 now". The writs show as faces; a press picks one; the primary reads "Discard to the deck's bottom · face down". Each discard is one Action. On the holder's own turn the at-will row stays open, so a mandate can be played instead.

### Asked out of turn

The asked seat is the only active seat; its turn header reads "Your turn" and the game's turn notification is sent. The action area's first line names the step for everyone.

- **`AnswerAttack`** (`AwaitingDefence`, R-3.14.1, R-3.14-H1). The defender's panel: "Ana conquers your knight at Desert 3: attack 3, defence 2." With an unplayed Defend: "Flip Defend · +1 defence · +1 vp · can't be undone" and "Let it stand · can't be undone". Without one: the same line, "You hold no Defend.", and only "Let it stand". On a phone the two answers stand pinned together, each reading on one line: one that would wrap beside the other takes a line of its own (checked at 390 px). The answer is never sent for the seat, even when it holds no Defend. Others see "Ana conquers Ben's knight at Desert 3. Ben answers." and the target outlined. Nothing on any other seat's screen depends on whether the defender holds Defend.
- **`AnswerStarve`** (`AwaitingImmunity`, R-3.14.2). As above: "Ana starves your serf at Forest 2." "Royal Immunity · 1 food · can't be undone" when the seat holds Defend and a food; otherwise "You can't answer." and "Let it go". Others see "Ben answers." and the marker outlined.

### At-will actions

Available to the turn player in `PlayingCards` while no card is picked, to the next finaliser in `SelectingHands`, to the asked seat in `Nourishing`, and in `DiscardingWrits` (R-4.4-H1). The **at-will row** sits under the hand: chips "Writs 2", "Tiles 1", "Vessels 1", "Immunity 1", each shown only when it has something to do. A chip press opens its list in the panel; Undo closes it.

- **`PlayMandate`** (R-4.4.2). Each held mandate is a face with its alternatives as buttons, dimmed with a reason when not affordable; mandates 6 and 8 offer the reward of each guild where the seat has 3★, and mandate 6's Alchemist reward offers one button per vessel ("Alchemist → submersible"), each dimmed while the general supply has none (R-4.4-H4). A press sends, or stages with "can't be undone" when it draws goods or flips a bead.
- **`DiscardWrit`** (R-4.4.4, R-4.4-H5, R-4.4-H8). Each writ has "Discard"; a press sends. It goes under face down: others read "Ana discarded a writ under the deck". A writ may be discarded at any time, so a seat holding one has the Writs chip whenever no card is picked, outside these windows too: off its turn the row sits under the waiting line. In a hotseat game each other seat holding a writ has a chip "Ben's writs" under the panel; its press opens that seat's writs, each with "Discard", sent as that seat.
- **`SpendRegionTile`** (R-4.3.3). Each collected tile has "Spend"; a press opens the five goods with the haversack's counts; a good press sends. Sulfur also offers "Into the barrel" while the barrel has room (R-4.10-H1). A press naming a card whose payment takes no tile (`Improve`, `TendLandscape`, Déjà Vu, Feast) is short until a tile is spent here first, so the dimmed reason says so (R-4.3-H3).
- **`PlaceVessel`** (R-4.2.2), own turn only. A vessel press lights the seat's pawns that stand on no vessel; a pawn press sends.
- **`ReclaimImmunitySeal`** (R-3.14.2). The seat's immune markers light on the map; a press sends "Take back the seal: the marker can be starved again".

A staged card and the at-will row never coexist: picking a card hides the row, and Undo back to no card shows it again.

### Round end

- **`Nourish`** (`Nourishing`, R-4.10). Asked, in turn order, of a seat with a real choice or one that may play at will (R-4.10-H4); a seat with only at-will plays sees its preselection already whole and the at-will row. The panel lists each pawn on the board (character and space), each lit on the map, with buttons "Food" and "Wine" (when the barrel holds sulfur), and "Unfed" in rose ("returns to supply") only when food and wine fall short (R-4.10-H3). The preselection feeds every pawn it can, food first, as an auto stage; presses change it, and a seat can never leave a pawn unfed that it could feed. The primary reads "Feed: 2 food, 1 wine". A short payment offers the tile cover. Others see the nourish row: seats in turn order, a tick on each done, "fed by the game" on seats not asked.
- **Progress roll** (`RollProgressDie`, R-4.11). Every seat sees the die roll, any rerolls, and the removed tile leave its stack, with the line "Desert: tile II removed". When an epoch is triggered the epoch sky glows on the next ray and the line adds "Epoch III dawns", the same when the step rolls no die (R-6.1-H1): "The progress die was not rolled · Epoch V dawned".
- **Dawn** (`BeginDawn`, `ReplenishMap`, `ReplenishGuilds`, R-4.12). The action area shows the **dawn sheet** to everyone while the dawn's actions play: one row per seat with guild ranks, landscapes, active regions and disloyalty (in rose), and the total; then the landscape fills, the map's new goods and (III) the guild refill. It stays, under the next decision, until the first press of that decision that is not the landscapes' own.
- **`CollectLandscapes`** (`CollectingLandscapes`, R-4.3.4, R-4.12.3). The asked serf's tended landscapes with resources light, each with "collect 3 · 1 to the ruler". Presses pick (tap list); the primary reads "Collect 2" or "Leave all". Others see the order row.
- **End of round** (`EndRound`, R-2.2.5). The start-player crown passes, the cards return to the seat panels, spent pouch goods leave. The next hand selection opens. After the V dawn there is no end of round: final scoring takes its place (R-6.1-H2), so the crown, the pouches and the played cards stay where they are.

### Game end

The game-end summary replaces the action area: one column per seat with what it scored before the V dawn, the V dawn, epic voyage by section, large empires (with sets), shillings, each sealed charter now face up with its score beneath it as "5 vp", the total, and the winner with the barrel tie-break when used (R-6.2, R-6.3), from `ScoreGame`'s metadata.

### Watching (waiting view)

The waiting view always says who decides and what, then the live state of a shared step, then what the previous seat just did, from the Action's input and `metadata`. Its rows: the finalise row, the combat tally (attack and defence; who answers is the waiting line's to say), the nourish row, the landscapes row and the dawn sheet. They are the same rows the deciding seat sees above its panel. A seat's own draft of its hand stays in the action area while it waits in `SelectingHands`; the waiting line sits above it.

### Hidden information, as others see it

Hidden things are drawn by rule, never because the client holds the data. A Local game or Host View holds every field; the perspective decides.

- **Hand** (R-3.1, R-5.1): other seats see backs and the count; nothing shows which cards are set aside. A drafted hand is never shown before it is played, and finalising shows only the pouch good.
- **Writs** (R-4.4.4): others see backs and counts; sealed charters as sealed backs. Enlarged, a back stays a back.
- **A writ draw**: others see the drawn count as backs and how many are kept; the writs put under are never shown to others.
- **Deck knowledge**: the owner's note on the deck in the margin and in the seat panel; nothing for others.
- **Seals** (R-5-H1): every seal red side up is the same crowned disc for everyone, its holder included. A flip to a bead shows its value to all.
- **Asks**: whether a seat holds Defend is never shown, and no prompt, button, delay or line on another seat's screen depends on it. The asked seat is never auto-answered.

## Coexistence and precedence

One semantic derivation in the session, the **board offer**, decides each board element's role: lit, picked, being decided, dimmed or plain, and its chip. Every board layer draws that result and nothing else. The bench reads one derivation of its own, the **bench offer**, from the same stages.

- **One staged action at a time.** The staged card or at-will action decides which layer lights targets. The at-will row and a staged card never coexist.
- **Lit and being decided never meet.** The board offer shows lit targets only to the deciding seat and the outline only to others. In `SelectingHands` every seat drafts, but drafting lights nothing on the board.
- **Chips.** One chip per target. A cost or threat (rose) wins over a role, which wins over a gain.
- **Dimming** belongs to an open map pick. Panel-only steps and the bench never dim the map; the bench covers it.
- **A popup** (a Move way, a character, a guild function, a feudum's guild, a harvest mode) sits beside its anchor and over the board. The board under it keeps its offer; a press outside it does nothing and closes nothing. Undo removes it.
- **The bench and the map.** The bench is open only from a staged guild function until its send or Undo. A Knight trade's tame and a Farmer trade's farm are map picks; for those the bench closes to a slim header ("Knight trade: tame the behemoth") over the board, and Undo reopens it.
- **What is open wins over what is under it.** The enlarged card sits above the open seat, the bench and the stack view, which sit above the table. Escape closes one layer at a time: the enlarged card, then the open seat or stack view, then full screen. Escape never closes the bench; Undo does.
- **History View offers no choices.** No panel, no lit target, no bench and no send. The being-decided outline, enlarge, open seat and focus keep working on the displayed state.
- **Undo** (`docs/user-interactions.md`): it pops the highest manual stage first (a Move step, a picked good, a popup's choice, the card), then undoes the Undo Candidate. It is hidden when neither exists, so it is hidden right after a barrier.
- **Hover** on a panel row brightens the board elements it names, only those its press would light. Under an open pick a dimmed element stays dimmed. Touch has no hover, and no information depends on it.
- **Asks interrupt nothing local.** When another seat's Conquer asks this seat, any local draft this seat holds belongs to no open decision and is cleared with the new state; the ask's panel replaces the waiting view.

## Shared visual state

The session owns these values. Components read them and call its methods. Every draft is read back only while it still applies, so a stale value offers nothing.

- **Hand draft** (`SelectingHands`). One stacked stage: the cards (a tap list) and the pouch good as each press left them, so Undo removes the last press of either kind. Producer: card and pouch presses. Consumers: the panel, the finalise button. Lifetime: the seat's `FinaliseHand`; Undo. It **survives** `other-action` and `reconciliation` transitions, keyed by the round, so another seat's finalise never clears it and a kept draft is never submitted in another round. It is cleared on undo and history transitions.
- **Turn draft** (`PlayingCards` and its follow-ups). Stages: card → mode (regular, special, forfeit; the two-cards toggle) → the card's targets and popups → cover (a tile for a short payment). Producer: hand, mode and button presses, lit-element presses, popups. Consumers: the panel, the board offer, the bench offer, the send. Lifetime: the send; Undo; every new displayed state. Validity: each stage must still be legal in the displayed state, or it offers nothing.
- **Move draft** (a Move card once the turn draft hands it off). Its own draft, registered ahead of the turn draft so Undo pops it first; a card, replay or mode press ends it. Stacked steps: each press pushes one step (piece, to, way), and Undo pops the last. Then Godspeed and pilfer as plain stages.
- **Bench draft.** Picked items (a tap list), the count toggle, a popup's choice. Lifetime: as the turn draft.
- **Follow-up drafts** (kept writs, favours, saltpeter and weapons, nourish choices, landscapes): each read back only in its own state and only for its named decider.
- **Board offer** and **bench offer.** Derived, never stored, from the displayed state, the valid actions and the stages. Effects: ring, chip, outline, dimming, ghosts and trails. Empty in History View except for the being-decided outline, and empty while `updatingVisibleState` is true.
- **Menu pointer.** Producer: a panel row's hover or keyboard focus. Consumers: board layers. Effect: the bright ring on what the row names. Lifetime: the row's leave, blur or unmount.
- **Card preview.** Producer: a press on a card, writ, tile or bead anywhere, or a magnifier. Consumer: the preview layer. It reads its owner's current props, so it shows a back where the owner shows a back. Lifetime: the next press, Escape, or the owner unmounting.
- **Open seat** and **stack view** (a region stack's tiles by epoch, or the deck's seen writs). Producer: a ribbon, a seat chip, a stack or the deck. Lifetime: the backdrop, Escape, the close button. They show the displayed state, History View included.
- **Board focus.** Producer: the focus chooser, or a map pick opening on a phone. Consumer: the scaling wrapper. A pan or zoom by hand clears it. It never changes an offer.
- **In-flight pieces.** Producer: the state-change animators. Consumer: the flight layer. Lifetime: the running timeline; cleared on teardown and interruption. Never read for game meaning.

Silent restoration replaces the displayed state; every derived offer follows it without motion.

## Render ownership

- **Board surface.** One SVG, scaled by the shared scaling wrapper (`expandable`, `coverBelowScale`). Layers in order: ground (terrain, frame, the epoch sky); routes; locations (discs, letters, start rings); space contents (landscapes, goods, abandoned vessels, markers, immunity seals); pieces (pawns with vessels, monsters); guild areas (each owns its grid and its track); tracks (stacks and chart, die, voyage, military, barrels, score ring); margin (deck, haversack, supply counts); motion (a running animator's tokens, none at rest, with a seal's token under the markers). Each layer owns the pick chrome of what it draws and dims its own unlit elements from the board offer. There is no global scrim.
- **Pieces on the board** sit in a centred outer wrapper for motion, with world placement on a separate node, so GSAP owns the wrapper's transform.
- **Moves within the board** (a pawn's path, goods from one guild area to another, a tile from a stack to the map, a marker from a track to a space) stay inside the board SVG and its coordinates, so they scale with it.
- **Flight layer.** A good, a writ, a tile or a marker moving between a seat panel (or seat chip) and the board crosses the scaling wrapper. One flight layer, mounted above the table layout and outside the wrapper, and inside the full-screen dialog while it is open, draws the moving copy from the two elements' screen rectangles. While it flies the source is hidden and the target not yet shown.
- **The bench** is drawn over the board's container, outside the scaled SVG, at a scale fixed for legibility. It draws the guild areas with the same components the board uses. While it is open the board's own guild areas keep their state and take no presses. Where the art is not supplied a Knight row is drawn as a short, wide band, so its press reaches 44 px down the same way, between the rows above and below it (S68).
- **Seat panels** sit outside the wrapper, in the Players tab on a desktop only; on a phone the seat strip stands in for them. The open seat and the enlarged card are mounted after the table layout and pad themselves by the safe-area insets.
- **Full screen** is the wrapper's modal dialog. While it is open the action panel is drawn in the wrapper's toolbar, and the bench, the popups and the enlarged card inside the dialog. Each is drawn in one place at a time.
- **Hidden things** are drawn by one card component, one writ component and one seal component, each taking a `faceShown` decision from the perspective rule, not from data presence.
- **The finalise, nourish and landscapes rows and the combat tally** are each drawn by one component, read from `flow` in the displayed state, in the panel and the waiting view alike. **The dawn sheet** is drawn by one component too; `flow` holds no dawn, so it reads the dawn's Action on the displayed state.

## Palette

Every colour a Feudum component names is one of these tokens, declared once under the title's scope and used as utility classes or variables. `palette.spec.ts` fails on a raw colour in the package, and on a token that is not declared. The seat colours are the exception: a seat's pawns, markers, discs, card borders, ribbon and Knight row wear the player's colour from the session's colourizer (`gameSession.colors`), so preferred and colour-blind colours carry through.

| Token                                                                    | Value                                                     | Used for                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `surface`                                                                | dusk indigo, `#221D33` at 85 %                            | the table behind the board, panel backgrounds                                                               |
| `surface-raised`                                                         | `#2E2744`                                                 | inner groups, popups, the bench's backdrop                                                                  |
| `parchment`, `ink`                                                       | `#EFE3C8`, `#3B2A1A`                                      | card, writ and tile faces, the seat panel's sheet, the bench's guild areas; text on them                    |
| `frame`                                                                  | amber-500 at 40 %                                         | the one frame per panel, tile borders, the active tab                                                       |
| `text`, `text-muted`, `heading`                                          | stone-100, stone-400, amber-200 at 80 %                   | body text, captions and disabled text, small uppercase headings                                             |
| `accent`, `accent-soft`                                                  | amber-300, amber-950 at 60 %                              | lit and picked rings, the Move trail, amber chips, the picked row's background                              |
| `control`, `control-hover`                                               | stone-700, stone-600                                      | buttons that are not the primary action                                                                     |
| `primary`, `primary-hover`, `primary-text`, `primary-border`             | stone-800, stone-700, amber-300, amber-300                | the one primary button per panel, and Undo                                                                  |
| `danger`, `danger-soft`                                                  | rose-400, rose-900 at 70 %                                | cost and threat chips, attack and starve targets, disloyalty, unfed pawns, refusal reasons                  |
| `decided`                                                                | stone-300                                                 | the being-decided dashed outline                                                                            |
| `divider`                                                                | stone-700 at 60 %                                         | rules between groups, unpicked option borders                                                               |
| `terrain-sea`, `-island`, `-forest`, `-desert`, `-badlands`, `-mountain` | teal, ochre-green, deep green, sand, umber, slate         | region fills and their hatching                                                                             |
| `route-road`, `-ship`, `-submersible`, `-flying`, `-ferry`               | tan, sea blue, violet, sky, rope brown                    | route lines and glyphs                                                                                      |
| `good-saltpeter`, `-sulfur`, `-iron`, `-wood`, `-food`                   | white, yellow, near-black with a light edge, brown, green | goods tokens (each also has its own silhouette)                                                             |
| `seal`, `bead`, `shilling`                                               | wax red with a crown, pale gold, silver                   | seals, beads, coins                                                                                         |
| `map-ink`, `terrain-line`                                                | near-black                                                | the starting spaces' double ring and the map's line work; hatching and region borders at 35 %               |
| `halo`, `dim`                                                            | near-black; near-black at 55 %                            | the dark halo under every ring, outline and chip; the veil over unlit map elements while a map pick is open |
| `parchment-shade`                                                        | a darker parchment                                        | fold lines, deckle edge and grain on parchment                                                              |
| `wood-piece`, `wood-dark`                                                | light wood, dark wood                                     | neutral wooden parts (epoch marker, die, barrel staves, the charter roll's roller) and their edges          |
| `good-iron-edge`                                                         | light grey                                                | iron's light edge, so it reads on dark ground                                                               |
| `sky-dawn`, `sky-dusk`                                                   | sunrise gold, dusk violet                                 | the epoch sky gradient above the map                                                                        |
| `river`                                                                  | river blue                                                | the river through the desert and badlands, under the routes                                                 |
| `board-frame`, `score-cell`                                              | dark wood; parchment                                      | the board's frame and the score ring's cells                                                                |
| `disc-outpost`, `disc-farm`, `disc-town`, `disc-feudum`                  | lilac, field green, yellow, teal                          | location disc faces, matching the printed disc colours; the type also has its own silhouette                |

- **Amber means "yours to act on":** a lit or picked target, the Move trail, the primary button, Undo, and an amber chip naming what a choice gives you. Nothing decorative is amber beyond the frame.
- **Rose means "costs or threatens":** a payment (shillings, goods turned in, a barrel sulfur, a ferry fare), a Conquer or Starve target, a vp loss (disloyalty), an unfed pawn, and a refusal's reason.
- **Rose is never a bare red shape.** A rose chip always carries a label and a dark halo. A seal is a game piece: it always carries its crown and never a halo, so a seal is never read as a cost and a cost never as a seal. A red seat colour appears only as a seat fill (pawns, markers, ribbon), never as a ring, a chip or a button.
- **The printed board's pink starting rings** are drawn as a double ring in map ink, so no pink or rose is drawn on the map except as a chip; with the printed map as the ground, its own ring lies under ours.
- Text on a surface is `text` or `text-muted`; on parchment, `ink`. The phone layout uses the same tokens.

## Game log and history

Built from each Action's input and `metadata` only (`docs/DESIGN.md`, Actions). A seat's line is past tense after its name ("You moved", "Ana moved"). Space names read as region and number ("Desert 3").

- **Lines, by Action:**
    - `ChooseStartingGoods`, `PlaceStartingPawn`: the goods and barrel choice; the character, space and rank taken.
    - `FinaliseHand`: "Ana finalised · pouch sulfur". The cards are named in the actor's own log only.
    - `Migrate`: the character and space, or "off"; Distant Kin.
    - `Move`: each piece's path with its ways ("monk Forest 2 → Island 1 by ferry (2s) → Island 2 by road"), vessels boarded, placed or left, Godspeed, the pilfer and where it came from, and the rank change when a pilfered target gives a waiting seat its marker.
    - `Influence`: markers placed and each space's new ruler, serf or subject; Money is Influence.
    - `Improve`, `TendLandscape`: the step, the disc and feudum guild, the tile taken and points, or the fallback tile, or why none was taken ("Forest tile not yet legal, none taken"; "no tile left" only when the region's stack is empty, R-4.3.2); the landscape and whether collected.
    - `Explore`, `KeepWrits`: "drew 3, kept 1, 2 under the deck"; the actor's own log names them. Shovels & Swords.
    - `Harvest`, `ChooseFavours`: the goods drawn, by kind, and the favours.
    - `Tax`: shillings, and the Reinforcements marker or "declined Reinforcements".
    - `Conquer`, `AnswerAttack`, `CommitAttack`: the target, "Ben flipped Defend" or "Ben let it stand", saltpeter and weapons, the strengths, the result, points and markers returned.
    - `StarveThePeople`, `AnswerStarve`: the marker, Royal Immunity or not, chicken beads returned.
    - `GuildAction`, `Feast`: the guild and function, items moved with their places, completions, points, the payment split, reeves, rank changes, the writ count drawn, a drawn bead's value, a flipped seal's value, spilt goods.
    - `PlaceDisc`: reeve, service or voyage, and where.
    - `PlayMandate`, `DiscardWrit`, `SpendRegionTile`, `PlaceVessel`, `ReclaimImmunitySeal`: the writ named (a discard is named in the owner's log only), the good, the vessel.
    - `Nourish` and `NourishPawns`: food and wine per seat; pawns unfed and returned; the rank changes once, on the one that ends nourishing (R-4.5-H1).
    - `RollProgressDie`: every face in order and the tile removed.
    - `BeginDawn`, `ReplenishMap`, `ReplenishGuilds`, `CollectLandscapes`: the dawn sheet's rows, each total signed as it falls (+5 vp, -6 vp); goods placed; beads flipped.
    - `EndRound`: pouch goods paid and the start player passed, folded into the round's last entry.
    - `ScoreGame`: the summary's rows.
- **Rank changes** are named on the Action that caused them ("Ana became Merchant master; Ben dropped to journeyman").
- **Grouping:** one entry per hand selection (a line per finaliser); one entry per turn, growing as its card, a declared second card, follow-ups, asks and at-will Actions arrive; one entry for nourishing; one for the progress roll; one per dawn. Bookkeeping System Actions (`StartRound`, `AdvanceTurn`) are skipped.
- **Interstitials:** epoch (from the epoch field) and round (from the round manager).
- **Jump** on a round, a turn and a dawn: a round shows the table as it began, a turn and a dawn as they ended. **Replay** on entries that move things on the board, over the entry's whole span: turns with Migrate, Move, Influence, Improve, Tend, Harvest, Conquer, Starve, a guild function or a feast; the progress roll; nourishing with unfed pawns; dawns.

## Animation plan

The game-session state-change animators and the shared `AnimationContext` own all motion caused by a committed transition. Each animator handles both modes: with an `action`, cinematic motion; without one (undo, history navigation), a direct `from → to` interpolation at or below 200 ms. Silent restoration has no motion. Stepping through History View is state-only navigation and plays only that interpolation; the history panel's Replay is the one way to see an entry's cinematic motion again.

| Animator           | Live motion (with action)                                                                                                                                                                                                | Triggered by                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Pawns and monsters | step along the path space by space, following each route's line; a vessel rides under its pawn; a ferry crosses with its glyph; Godspeed's step after a pause; a pinned pawn never moves                                 | `Move`                                                                                      |
| Pawn presence      | a pawn flies from the seat panel to its space and its character face turns; off the board it flies back; a conquered or unfed pawn flies home after a rose flash                                                         | `PlaceStartingPawn`, `Migrate`, `CommitAttack`, `NourishPawns`, `Nourish`                   |
| Markers            | fly from the seat panel to the space; a ruler and a serf swap places when roles change; returned markers fly home; guild track markers slide between rank spaces; Knight row markers fill sections                       | `Influence`, `Improve`, `CommitAttack`, `StarveThePeople`, rank changes, `GuildAction`      |
| Goods              | fly between spaces, guild areas, seat panels and the haversack along a short arc, one after another a few frames apart; a pilfered good hops from space to piece then to the seat                                        | every goods move                                                                            |
| Shillings          | coins fly from payer to master, journeyman and charity in order                                                                                                                                                          | payments                                                                                    |
| Tiles              | a stack's top tile flies to the seat panel; a landscape flips to its back as it lands on a space; a removed tile fades out of its stack                                                                                  | `Improve`, `TendLandscape`, `RollProgressDie`                                               |
| Discs              | a location disc flips to its new face on improvement or conquest                                                                                                                                                         | `Improve`, `CommitAttack`                                                                   |
| Writs              | the deck to the panel: faces to the drawer, backs to others; kept writs to the seat panel; the rest back under the deck as backs; a played writ shows face up over the table, then goes under; a discard flies as a back | `Explore`, `KeepWrits`, `PlaceDisc` (voyage), threshold pulls, `PlayMandate`, `DiscardWrit` |
| Seals and beads    | a seal flips in place to show its bead; a bead moves to the rosary or a chicken; the hidden-bead draw lifts the two candidates, then one settles                                                                         | Monk and Noble functions, Farmer pull, mandate 8, dawn III                                  |
| Die                | the progress die tumbles, settles on a region face; a reroll tumbles again; the stack it names pulses                                                                                                                    | `RollProgressDie`                                                                           |
| Dawn               | the epoch marker moves to the next ray; each seat's score disc slides along the ring as the dawn sheet's rows appear; disloyalty slides back with a rose chip                                                            | `BeginDawn`                                                                                 |
| Combat             | the tally chips rise over the space; a flipped Defend turns face up beside the defender; the result                                                                                                                      | `AnswerAttack`, `CommitAttack`                                                              |
| Score              | every score change slides the seat's disc along the ring                                                                                                                                                                 | every vp gain                                                                               |

- System Actions that follow one user Action play in sequence on one timeline, each tween at an explicit position. Example: a `Move` lands, `AdvanceTurn` passes, the next turn's pulse begins.
- Interaction is gated while `updatingVisibleState` is true.
- Replay plays the entry's whole span, contiguous System Actions included.
- **Fast fallback.** Without an action every context-owned path is bounded at or below 200 ms: pieces and tokens interpolate straight to their new places, flips and fades are cut to that bound.
- **Reduced motion.** With reduced motion every animator follows each step with no tween; the order of the steps and their history lines are unchanged.
- **Local motion only:** hover feedback, the turn pulse, a ring's appearance, the Move trail and ghosts (drafts, not committed state). The seat panels keep a fixed turn order and do not reorder, so no `animate:flip` is used.

## Phone layout

Target: 375 × 812, held upright. Budget, top to bottom:

| Region           | Height                     | Notes                                                                                |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| History controls | ~36 px                     | `mobileControlsContent`                                                              |
| Turn header      | 28 px                      | compacted under `max-sm:`                                                            |
| Status strip     | 28 px                      | epoch and round; this seat's goods, shillings, barrel and free discs                 |
| Action area      | at most 36 % of the column | short prompts, button rows that wrap, 44 px targets; popups anchor on the board      |
| Board            | the rest, ~380 px          | scaling wrapper with `coverBelowScale`; focus chooser in the overlay with `insetTop` |
| Seat strip       | 44 px                      | one chip per seat                                                                    |

- **Board.** The board with its margin is about 2.3:1. Fitted to 375 px it would be about 165 px tall and its spaces too small to tap. It rests at a cover fit and opens on the map.
- **Focus chooser.** Four chips over the board's top edge: Map, West guilds, East guilds, Tracks. This departs from Oath, which has no chooser on a phone, because Feudum players look at every area every turn. Map and the guild chips frame that part of the board; a chip carries a lit dot while its area holds a lit target.
- **Tracks sheet.** The tracks lie scattered round the printed board, and framing them all leaves them too small to read on a phone. The Tracks chip instead opens a bottom sheet, up to 80 % of the dynamic viewport, that redraws them at full size in one column: epoch and round, the region tile stacks and chart, the progress die, the krud barrels, the voyage track, military service and the score track. The sheet is for looking: it offers no target, and a pick that lights a track (a voyage disc, a service disc) frames that track on the board instead.
- **Pick framing.** When a map pick opens on a phone, the board frames the lit targets (up to 2.5×). A guild pick frames the guild column holding lit areas, the West first when both do. This is the one place a choice moves the focus. A hand pan clears it.
- **The bench** is a bottom sheet up to 80 % of the dynamic viewport: from-guild above, to-guild below, the result line and the primary button in the sheet's footer while it is open (one place at a time). The areas narrow from the column's width until both stand whole between the title and the footer, so every row of a market or a Knight panel is in sight without scrolling (checked at 390 × 844). A map pick from the bench (a tame, a farm) collapses the sheet to its header.
- **The hand.** In hand selection the eleven cards stand in two rows (six, five) at the column's width, each with a magnifier; the pouch row and the finalise button share one line under them. The finalise order shares the prompt's line, each seat by its colour, which the seat strip names. In card play the hand is one row of up to five; each card's preview path stands beneath it on one line and reads "On board", where "Show on board" has no room, its accessible name staying "Show on board: <card>" (checked at 390 px). A magnifier enlarges a card to the screen width less 32 px.
- **Sends.** Two sends side by side (the defender's answers, the starve answers, a keep beside a keep with Shovels & Swords) stand in one pinned group. Each takes its own width and the line's spare room, so two short ones share a line and a long one takes a line of its own, its words on one line.
- **Move on a phone.** The allowance and "Stop moving" share the panel's one line; steps, the trail and way popups are on the framed map.
- **Seat strip.** Each chip shows the seat colour, a short name, the score, hand count and writ count, with the turn pulse. A press opens the seat panel as a bottom sheet, up to 85 % of the dynamic viewport, scrolling inside.
- **Dawn sheet and game end** scroll inside the action area's 36 %, one seat per row. A dawn row runs its ranks, landscapes, regions and disloyalty on as one line under the seat's name and total, inside the column's width. The send stays on the line of the row before it while it keeps 8rem there, and otherwise takes a line of its own. A game-end seat runs its categories on as one line under its name and total, its sealed charters 44 px wide beside them with "5 vp" beneath, a press enlarging one; three seats stand whole in the action area (checked at 390 × 844).
- **Held sideways** (812 × 375), the action area caps at 40 % and the board fits the chosen view by height.
- **Full screen** keeps play going: the action panel in the toolbar.
- No hover anywhere; every hover effect has a press path or is not needed (a touch tap on a panel row shows its preview, as MarraCash's `hoverOrTap` does).

## What the model supplies

- **Offers and previews come from the rules.** The logic package exposes, for a staged input, the legal targets of the next stage (pieces, ways, spaces, guild functions, bench items, writs, covers) and a preview of the outcome: points, completions and thresholds, the payment split, reeve points, combat strengths, harvest totals, the writ count an Explore draws, and whether the send will set `revealsInfo`. The UI draws these and re-derives no rule.
- **History lines read `metadata`.** Each Action records the values its line names that the input does not carry: Move's ways, vessels and pilfer source; role changes from Influence; the disc and tile taken; goods drawn; payments split; rank changes; combat strengths and result; bead and seal values; the die's faces and the tile removed; each dawn row; nourish results; pouch goods paid; the final breakdown with charters revealed.

## Verification scenarios

Each gives the start, the input, the result, the result after Undo or exit, and how it is checked. "Auto" is a component or browser test; "Manual" is a person at desktop and phone width.

**Setup**

- **S1. `ChooseStartingGoods`.** Setup, this seat first. Pick saltpeter, sulfur, food: the sulfur popup asks supply or barrel; choose barrel. The primary names all three. Undo: the barrel choice, then food, then sulfur, one per press. Send: three goods fly from the haversack, the sulfur into the barrel; the next seat is asked. Auto.
- **S2. `PlaceStartingPawn`, either order.** Pick Knight: its rank chip reads "master"; the six starting spaces light, the map dims. Press Desert 3: sent; the pawn flies there and a marker lands on the Knight master space. Repeat with the space first, then the character popup. Undo before the send steps back one press. Auto.
- **S3. Rank chips follow the tracks.** A later seat in a four-player game picking Knight after two others: the chip reads "apprentice"; once the track is full it reads "no rank". Auto.

**Hand selection**

- **S4. Draft and finalise in order.** Seat 2 drafts four cards and sulfur while seat 1 has not finalised: seat 2's primary reads "Waiting for ‹seat 1› to finalise". Seat 1 finalises with saltpeter: seat 2's draft is unchanged, the finalise row shows seat 1's tick and saltpeter, and seat 2's primary becomes "Long live the king · can't be undone". Auto.
- **S5. Saltpeter count.** Choose saltpeter: the count reads "4 of 5" and the primary is disabled until a fifth card. Choose no pouch with five picked: "5 of 4", disabled. Undo removes the last press. Auto.
- **S6. Pouch from barrel refused.** A seat whose only sulfur is in its barrel: "Sulfur" is dimmed; a press gives "Barrel sulfur can't go in the pouch." Auto.
- **S7. Conquer warning.** Draft Conquer with three other cards: the warning line shows. It does not disable the finalise. Auto.
- **S8. Finalise is a barrier.** After the send, Undo is not offered for it; other seats' panels show four backs and the pouch good. Auto.
- **S9. Draft survives a reconciliation.** With a draft held, a state reconciliation arrives: the draft is unchanged. A new round's selection opens with an empty draft. Auto.

**Card play**

- **S10. Card modes.** Pick Influence with a Merchant on a space ruled by a lone opponent marker: the space lights with "Money is Influence · 1s" in rose; the primary reads "Influence". Press the space: the primary names it. Undo: the space, then the card. Auto.
- **S11. Forfeit only.** A seat whose last card is Conquer: the card shows only "Forfeit". Its press sends; the seat panel marks it "forfeited". Auto.
- **S12. Two cards.** With sulfur in the pouch, pick Tax and turn on "Play two cards this turn": Tax sends; the panel reads "Your second card" and shows the hand. The pouch is marked spent. Auto.
- **S13. `Migrate` onto the board.** Pick Migrate, press a supply pawn: legal spaces light with "1 food"; with an Alchemist pawn on the board and Distant Kin on, every starting space lights with "Distant Kin". Press a space, then Monk in the popup: sent; the pawn flies in with its monk face; guild status updates. Undo is offered and reverses it. Auto.
- **S14. `Migrate` off.** Press a map pawn with "off": sent; it flies home. Auto.
- **S15. `Improve` to a feudum.** Rule a town, hold a seal: the town lights "→ feudum · 1 seal"; press it: the guild popup; press Noble: the primary names it with "can't be undone", since the tile it takes was hidden; press that: sent. The disc flips, the tile flies to the seat panel, the score disc slides. Auto.
- **S16. `Improve` with a prohibited tile.** In epoch I with the region's top tile II: the panel says so and lights no stack, since none is earlier (R-4.3.2); the send takes nothing and Undo is offered. In epoch III with the top tile IV: stacks with an earlier tile light with "no vp"; a press stages, and the primary sends. Auto.
- **S17. `TendLandscape`.** Pick Improve's special, then a collected tile: serf spaces with no landscape light. Press one, then "Collect 3 food · 1 to the ruler": sent; the tile lands back side up, three food appear, two fly to the seat and one to the ruler. Auto.
- **S18. `Explore` and keep.** Rule an outpost and a feudum: the primary reads "Explore: draw 3 writs · can't be undone". Send: the drawer sees three faces, others three backs. Pick one; the primary reads "Keep 1 · 2 under the deck". With an iron, the Shovels & Swords button shows. Keep: two backs go under; the drawer's note reads "you know 2 under the deck"; others see no faces. No Undo after Explore. Auto.
- **S19. Shovels & Swords.** From S18, press "Keep, then Shovels & Swords": two more faces show to the drawer; keep one more. The second keep has no Shovels & Swords button. Auto.
- **S20. `Harvest` with favours.** Hold two +2 beads, press a lit farm: the popup shows "Favours: 6 here, 3 to you" with "your 2 beads turn to seals" in rose. Choose it; the primary reads "… · can't be undone". Send: goods fly from the haversack, six to the farm and three to the seat; the beads turn to seals. Auto.
- **S21. Inspect the harvest.** With a Farmer pawn and three farms ruled, for a total of 7: choose "Inspect the harvest"; after the send the drawn goods show in a row with "Take 2 as favours". Pick two; send. "No favours" sends instead. Undo before the favours send takes back a pick; no Undo of the Harvest. Auto.
- **S22. `Tax` with Reinforcements.** With a Knight pawn and three towns ruled: the Tax button reads "Tax · +4s", dimmed, beside "Collect Reinforcements · +1 marker" and "Decline Reinforcements". Collect, and the button reads "Tax · +4s · Reinforcements +1 marker"; decline, and it reads "Tax · +4s". One press sends; Undo is offered. Auto.
- **S23. `Repeat` and Déjà Vu.** After playing Move and Explore: Repeat lights Move, with no note, and with a saltpeter Explore with "Déjà Vu · 1 saltpeter"; Conquer and Defend never light. Pick Move: Move's stages follow; the seat panel marks the Repeat. Auto.
- **S24. `PlayDefend` in turn.** One press sends; +1 vp; the card shows "Defend". Auto.

**Move**

- **S25. Steps and trail.** Two pawns and a monster (allowance 3). Press a pawn: its next spaces light with their ways. Press a road neighbour: the trail draws "1", the count reads "2 of 3", the pawn stays picked. Press a ship neighbour where only the ship reaches: step "2". Undo: step 2 goes, then step 1. Auto.
- **S26. Way popup.** A space reached two ways, say by road and by flying machine: a press opens the popup with "Road" and "Place your flying machine". A ferry's way reads "ferry · 2s" on its chip (rose); no two printed spaces are joined by both a road and a ferry, so its popup row is exercised on its own. With a vessel for sale, the ferry is absent. Auto.
- **S27. Vessels.** A pawn with a ship in supply at a port: the ship neighbour lights "place your ship"; an abandoned submersible on its space adds "board the submersible". Each choice is a step; the send places or boards it. A ship another pawn left this turn lights nothing to board (R-4.2-H2). Auto.
- **S28. Pinned.** An opponent's monster on a pawn's space: the pawn is unlit with "pinned"; the seat's other pieces light. Auto.
- **S29. Godspeed and pilfer.** With a Monk pawn, end the steps with "Stop moving": monks light and "No Godspeed" shows; take a Godspeed step (lighter trail). Then the pilfer chips: a farm the seat rules shows none; an opponent's landscape shows its target. Pick iron on a space; the primary reads "Move · 3 steps · pilfer 1 iron". Send; Undo is offered and reverses the whole Move. Auto.
- **S30. Allowance spent.** Take the last step: Godspeed or pilfer opens with no "Stop moving" press. Auto.
- **S31. Second successful move.** After a Repeat of Move: the voyage question follows; "Place your voyage disc on space 1?" Place: the disc lands. With a disc on 1, "Advance to 2? draws 2 writs · can't be undone". Auto.

**Conquer, Starve and asks**

- **S32. Conquer that asks.** Target an opponent's pawn whose owner has unplayed cards and has not played Defend: the chip reads "3 vs 2"; the primary names "Ana may answer · can't be undone". Send: Ana is the only active seat; others read "Ana answers." No Undo for the attacker. Auto.
- **S33. Defender with Defend.** Ana's panel shows "Flip Defend · +1 defence · +1 vp · can't be undone" and "Let it stand". Flip: the card turns face up in her panel; the tally shows defence 3; the attacker's `CommittingAttack` opens if they can add anything; if they can't, the combat resolves now (R-4.8-H5). Auto.
- **S34. Defender without Defend.** Same start, Ana holds no Defend: her panel shows "You hold no Defend." and only "Let it stand"; no answer is sent until she presses. The attacker's and a third seat's screens are identical, pixel for pixel in the action area, to S33 before the answer. Auto (screenshot compare) and Manual.
- **S35. Conquer that does not ask.** The defender has played Defend this round: the Conquer sends without "can't be undone" and goes to `CommittingAttack`; Undo is offered back to the Conquer. Auto.
- **S36. `CommitAttack`.** Add a saltpeter and mandate 3's free sword: the tally rises to 5; the primary reads "Attack 5 vs 3: wins · +2 vp". Send: the defender's pawn flies home, score slides, the military service question follows. Undo before the send removes the sword, then the saltpeter. Auto.
- **S37. Feudum conquest.** Win against a feudum with the attacker's serf there: the disc flips to an outpost, markers fly home, the serf becomes ruler; rank changes are named in the log. Auto.
- **S38. Starve with Royal Immunity.** Starve a serf; Ben holds Defend and a food: "Royal Immunity · 1 food · can't be undone". Press it: the starve is cancelled; a crowned seal slides under the serf; the marker is unlit for later starves. Auto.
- **S39. Reclaim the seal.** In Ben's turn, the at-will "Immunity" chip lights his marker; a press sends and the seal flies to his supply. Auto.

**Guilds**

- **S40. Guild pick and functions.** Pick Guild: guild areas this seat may use light; a guild used this round is unlit. Press Merchant: the popup lists Trade, Pull and Push with costs and outcomes; a function the seat holds no rank for is dimmed with its reason. Undo closes the popup, then the card. Auto.
- **S41. Merchant pull with count.** Journeyman of Merchant: the bench shows the barn (left, or above on the phone) and market (right, or below). Press iron, iron, wood: ghosts land in the bins' next spaces; one row and two columns complete; the toggle preselects "Columns (2)"; the result line reads "3 vp · 2 writs, keep 1 · can't be undone". Undo takes back the last good. Send: goods fly barn → market; the keep follows. Auto.
- **S42. Below threshold.** A pull that completes nothing: the result line reads "0 vp · no writ"; the primary sends without "can't be undone"; a seat with a disc is then offered a reeve (R-4.7-H1). Auto.
- **S43. Alchemist push inventions.** Master of Alchemist with carts for a ship and a krud barrel: press Ship, then Krud barrel (first price); the barrel fills the leading section of every Knight row as ghosts. Send: goods to the haversack, the ship to the vessel space, markers into the rows. Auto.
- **S44. Knight trade and tame.** With 4 markers in the seat's row: "3s: take 4 markers"; the popup offers the behemoth. Pick it: when it may be deployed to more than one space, the bench collapses to its header and those spaces light; press one (a single space is picked for you): sent; three markers leave, one to the monster icon, the behemoth appears with the seat's collar. Undo reopens the bench, then the popup. Auto.
- **S45. Noble pull picks.** Rows of two colours, then two empty scroll spaces: a third row press of a used colour does nothing. Seals land unseen (crowned discs). Auto.
- **S46. Monk trade.** The two candidate beads are lit; "Draw a bead · can't be undone". Send: both rise; the drawn one settles in the seat panel with its value; the other returns to its place. Auto.
- **S47. Feast.** With barrel sulfur, on a space shared with Ana (Merchant master): "feast · 1 barrel sulfur"; the popup lists "Ana · Merchant push". The bench opens for Merchant push; the result line includes "+3 vp feast" and no reeve. Auto.
- **S48. Short payment covered.** A `Migrate` short of its food with a tile held: the primary becomes "Cover with a tile"; pick the tile and the good. Without a tile: the mode is dimmed with its reason. Guild prices are in shillings, which a tile never brings, so a short price is dimmed with its reason and offers no cover (R-4.6.2). Feast short of barrel sulfur with a tile is dimmed with "Undo, then spend a region tile." (R-4.3-H3). Auto.
- **S49. Reeve offer.** After a push or pull, threshold reached or not (R-4.7-H1), with a free disc and no reeve there: "Place a reeve in the Merchant Guild?" Place: the disc lands beside the rank; +1 vp. "Keep the disc" leaves it. Auto.

**At-will, writ limit, round end**

- **S50. At-will row.** With no card picked: chips show only where something can be done. Open Writs: mandate 5 shows "A: 1 food → 3s". Press A: sent; the writ shows face up to all, then goes under; the margin's "seen" note counts it. Picking a card hides the row. Auto.
- **S51. Charters at game end.** A charter held with a seal offers only "Discard" during play (R-4.4.3). At the end, final scoring puts the seal on it, the best-paying charter first, and the summary shows it face up with its score (R-4.4-H6). Auto.
- **S52. Writ limit.** End a card holding 4 writs: `DiscardingWrits` opens; discard one: its back flies under the deck, the same for every seat; the turn passes. Playing a mandate from the row instead also brings it to 3. A seat off its turn left holding 4 is asked the same before play goes on, with the discard alone; the turn stays (R-4.4-H9). Auto.
- **S53. Nourish choice.** Three pawns, one food, one barrel sulfur: the preselection feeds food, wine and leaves the third "Unfed" in rose; the seat picks which pawn that is. Send: food flies to the haversack, the sulfur sits on the wine-fed pawn, the unfed pawn flies home. A seat with no choice is "fed by the game". Auto.
- **S54. Progress roll and dawn.** The die tumbles, settles on Desert; its tile I is removed, showing a tile II. When four tile II tops show, the epoch sky glows on II, and the dawn sheet shows each seat's ranks, landscapes, active regions and disloyalty (rose). Score discs slide. Auto (with a fixed die) and Manual for the motion.
- **S55. Collect landscapes.** At a dawn, the asked serf's filled landscapes light; collect one, leave one: resources fly as chosen, one to the ruler. Auto.
- **S56. End of game.** After the V dawn: the summary lists every category, sealed charters face up with scores, and a tie broken by barrel sulfur named. Auto.

**Hidden information**

- **S57. Others' hands and writs.** From another seat's perspective: hand backs with count, no set-aside shown; writs as backs; enlarging a back shows a back; no writ face in the log. In Host View the faces show. Auto.
- **S58. Seals for everyone.** A seat's held seals show as crowned discs to its owner too; a Noble push flips two seals and their values appear to all at once. Auto.

**Board, panels, history and motion**

- **S59. Enlarge.** Press a card in another seat's panel, a writ in your own, a region tile, a stack: each enlarges and nothing else changes; Escape closes it. Auto.
- **S60. Hover preview.** Hover the "Improve" button with no pick open: the improvable spaces brighten; leave: they return. On touch, a tap on the row's preview path shows the same. Auto.
- **S61. History View.** Step back into a turn with a Move: no panel, no lit target; the being-decided outline shows where public; enlarge and open seat work. The description reads the Move's line. Auto.
- **S62. Undo through stages, then an Action.** Stage Move steps 1–2, pilfer: Undo pops pilfer, step 2, step 1, the card, then undoes the previous undoable Action, then stops at the round's barrier and hides. Auto.
- **S63. Fast fallback and silent restore.** Undo a Move: the pieces interpolate back within 200 ms. Step backward and forward in history: every transition is the 200 ms interpolation. Reconnect mid-game: the state appears with no motion. Auto (duration inspection) and Manual.
- **S64. Replay.** Replay a turn entry with a Move and a pilfer: the steps play along their routes, then the pilfer; the table returns to where it was. Replay a dawn: the epoch marker and score discs move. Manual.
- **S65. Reduced motion.** With reduced motion on, a live Move updates the pieces with no tween, in the same order, and the log line is unchanged. Auto.
- **S66. Interruption.** A second Action arrives mid-flight: the flight layer clears, the board shows the latest state, no element stays hidden. Auto.
- **S67. Phone board.** At 375 × 812 the board opens on the Map view under four chips; a Move pick frames the lit spaces; a hand pan clears it; a guild pick frames the West guilds and the East chip carries a lit dot. Auto at 375 × 812 and 812 × 375.
- **S68. Phone bench and hand.** At 375 × 812, a Merchant pull opens the bench as a bottom sheet with the result and primary in its footer; the eleven-card draft fits two rows with the finalise line under them, no sideways scroll in the game column. Auto.
- **S69. Phone seat strip.** A seat chip opens the seat panel as a sheet; a card in it enlarges above the sheet. Auto.
- **S70. Full screen.** In full screen the action panel sits in the toolbar; a guild function's bench and popups open inside the dialog; a send works. Manual.
- **S71. Palette.** `palette.spec.ts` passes; a rose chip always has a label and halo; a seal never has a halo. Auto.
- **S72. Geometry.** `boardGeometry.spec.ts`: every space, route, guild grid space and track space in the logic's data has a position, and no position names a missing id. Auto.
- **S73. Phone Tracks sheet.** At 375 × 812, the Tracks chip opens the sheet with every track legible (text at least 11 px), scrolling inside, with no lit target in it; a voyage-disc pick frames the voyage track on the board. Auto.

## Exercise record

Each scenario is marked automated (with its spec) or checked (with date and width) as it passes.

Hosted walkthrough, checked 2026-11-11: on the local hosted site, a hotseat game for each of two, three, four and five seats, played to its end at 1440 × 900 by sending the scripted player's inputs through the page's own session. At every step the seat asked to act and the Action types it was offered matched the logic's, and the state the page held matched the scripted run's. Undo, at three early steps where one was offered, gave back the state before the Action; a refresh at five points restored the same table; no line on the page and no accessible name showed a raw id, `undefined` or `NaN`. A three-seat game was also played at 390 × 844 with touch, once to its end and once through its opening thirty inputs. The two-seat game of the first such run is the rehearsal fixture `games/feudum/rehearsals/first-game`, replayed by `pnpm rehearse feudum`. A hotseat table shows each seat's own view in turn on one page, so the per-seat projections are held by the scripted games' projected replay and the hidden-information scenarios above, not by this walkthrough.

- S1: automated (`actionPanelSession.spec.ts`, `actionPanel.spec.ts`; browser `tests/actionPanel.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosSetup.spec.ts`; the five goods in sight in the panel at 1440 × 900 and 390 × 844, `tests/desktop.spec.ts`, `tests/phone.spec.ts`
- S2: automated (`actionPanelSession.spec.ts`, `actionPanel.spec.ts`; browser `tests/actionPanel.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosSetup.spec.ts`
- S3: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosSetup.spec.ts`
- S4: automated (`actionPanelSession.spec.ts`, `actionPanel.spec.ts`; browser `tests/actionPanel.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosHands.spec.ts`
- S5: automated (`actionPanelSession.spec.ts`, `actionPanel.spec.ts`; browser `tests/actionPanel.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosHands.spec.ts`
- S6: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosHands.spec.ts`
- S7: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosHands.spec.ts`
- S8: automated (`actionPanelSession.spec.ts`, `actionPanel.spec.ts`; browser `tests/actionPanel.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosHands.spec.ts`
- S9: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosHands.spec.ts`
- S10: automated (`actionPanelSession.spec.ts`); browser `tests/actionPanel.spec.ts`; browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S11: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S12: automated (`actionPanelSession.spec.ts`); browser `tests/actionPanel.spec.ts`; browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S13: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S14: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S15: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S16: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S17: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S18: automated (`actionPanelSession.spec.ts`, `actionPanel.spec.ts`; browser `tests/actionPanel.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S19: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S20: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S21: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S22: automated (`actionPanelSession.spec.ts`, `turnDraft.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S23: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S24: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosCards.spec.ts`
- S25: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMove.spec.ts`
- S26: automated (`moveDraft.spec.ts`, `actionPanelSession.spec.ts`: the ferry's popup row, since no printed pair of spaces reaches it); browser at desktop and phone by named fixture, `tests/scenariosMove.spec.ts`: the road and machine popup, the ferry's rose chip, and no ferry with a vessel for sale
- S27: automated (`moveDraft.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMove.spec.ts`
- S28: automated (`moveDraft.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMove.spec.ts`
- S29: automated (`moveDraft.spec.ts`, `actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMove.spec.ts`
- S30: automated (`moveDraft.spec.ts`, `actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMove.spec.ts`
- S31: automated (`actionPanelSession.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMove.spec.ts`
- S32: automated (`followUpPanels.spec.ts`, `waitingView.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`
- S33: automated (`followUpPanels.spec.ts`, `waitingView.spec.ts`; browser `tests/followUpPanels.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`
- S34: automated (`waitingView.spec.ts`, `followUpPanels.spec.ts`; browser compare of the page's markup and the action area's pixels in `tests/followUpPanels.spec.ts`; what the previous seat just did `actionDescriptions.spec.ts`); the same compare, attacker and third seat, browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`; open: Manual, for a person to compare the two screens by eye
- S35: browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`
- S36: automated (`followUpDrafts.spec.ts`, `followUpPanels.spec.ts`; browser `tests/followUpPanels.spec.ts`; the defender's pawn home and the score after it `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`, through the military service question
- S37: automated (`followUpDrafts.spec.ts`: the win comes from the logic package; the markers home `flightLayer.spec.ts`; the flip and the rank changes in the log, on the Action that caused them, `actionDescriptions.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`
- S38: automated (`followUpPanels.spec.ts`, `waitingView.spec.ts`; the seal under the marker `mapLayers.spec.ts`; browser `tests/followUpPanels.spec.ts`; the seal's slide `boardAnimators.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`
- S39: automated (`followUpPanels.spec.ts`, `atWillDraft.spec.ts`; the seal's flight `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosConquer.spec.ts`
- S40: automated (`guildDraft.spec.ts`; browser `tests/bench.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S41: automated (`guildDraft.spec.ts`, `benchOffer.spec.ts`, `bench.spec.ts`, the barn-to-market pair on send `boardAnimators.spec.ts`; browser `tests/bench.spec.ts`; the legs to and from a seat's panel `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S42: automated (`guildDraft.spec.ts`, `bench.spec.ts`; browser `tests/bench.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S43: automated (`guildDraft.spec.ts`, `benchOffer.spec.ts`, `bench.spec.ts`, the Knight row's fill on send `boardAnimators.spec.ts`; browser `tests/bench.spec.ts`; the legs to and from a seat's panel `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S44: automated (`guildDraft.spec.ts`, `bench.spec.ts`, the marker onto the icon `boardAnimators.spec.ts`; browser `tests/bench.spec.ts`; the returned markers' flight `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S45: automated (`guildDraft.spec.ts`, `benchOffer.spec.ts`, `bench.spec.ts`; browser `tests/bench.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S46: automated (`guildDraft.spec.ts`, `bench.spec.ts`; browser `tests/bench.spec.ts`; the bead's rise and settling on send `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S47: automated (`guildDraft.spec.ts`, `bench.spec.ts`; browser `tests/bench.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S48: automated (`turnDraft.spec.ts`, `guildDraft.spec.ts`; browser `tests/bench.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`
- S49: automated (browser at desktop and phone by named fixture, `tests/scenariosGuilds.spec.ts`)
- S50: automated (`followUpPanels.spec.ts`, `atWillDraft.spec.ts`, the discard off the seat's turn and in a hotseat included; browser `tests/followUpPanels.spec.ts`; the writ shown to all then going under `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosRoundEnd.spec.ts`
- S51: automated (`followUpPanels.spec.ts`, `atWillDraft.spec.ts`, `waitingView.spec.ts`; browser `tests/followUpPanels.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosRoundEnd.spec.ts`
- S52: automated (`followUpPanels.spec.ts`; browser `tests/followUpPanels.spec.ts`; the back going under `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosRoundEnd.spec.ts`
- S53: automated (`followUpPanels.spec.ts`, `followUpDrafts.spec.ts`, `waitingView.spec.ts`; browser `tests/followUpPanels.spec.ts`; the flights `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosRoundEnd.spec.ts`
- S54: partly automated (`waitingView.spec.ts`, `components/actionPanel.spec.ts`; browser `tests/followUpPanels.spec.ts`; the die's tumble, the epoch glow, the score discs' slide `boardAnimators.spec.ts`, browser `tests/boardAnimators.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosRoundEnd.spec.ts`; open: Manual for the motion, for a person at desktop and phone width to watch the die tumble and settle, the tile I leave, the epoch sky glow and the score discs slide, and judge that each reads in turn
- S55: automated (`followUpPanels.spec.ts`, `waitingView.spec.ts`; browser `tests/followUpPanels.spec.ts`; the flights `flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosRoundEnd.spec.ts`
- S56: automated (`waitingView.spec.ts`, `components/actionPanel.spec.ts`; browser `tests/followUpPanels.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosRoundEnd.spec.ts`
- S57: automated for the log (`actionDescriptions.spec.ts`: from real projections for another seat and a spectator, and from a Local game's canonical Action, no hand or writ face in a line; Host View and the actor name them); the seat panel and the enlarged backs in `seatPanel.spec.ts`; browser at desktop and phone by named fixture, `tests/scenariosHidden.spec.ts`: the owner's kept charter and card, another seat's one hand back with no set-aside and its writ as a back, both backs enlarged as backs, no writ face in the History list; Host View in the browser by a stand-in, the session viewing as host and given the whole state, since the fixture page hosts no game
- S58: automated (browser at desktop and phone by named fixture, `tests/scenariosHidden.spec.ts`, from real play: a bought seal is a crowned disc with no value to its owner and to another seat; a Noble push flips both seals in the one Action, and every seat's table reads the same beads and the same line naming both values)
- S59: automated (browser at desktop and phone by named fixture, `tests/scenariosBoard.spec.ts`: another seat's card, the own writ, a region stack opened and a tile in it; each enlarges, Escape closes it, and neither the shown state nor the server's changes)
- S60: automated (browser at desktop and phone by named fixture, `tests/scenariosBoard.spec.ts`: a hover at the desk and the row's preview press on touch brighten the improvable spaces and take them away; the brightened set is the set the pick then lights)
- S61: automated (browser `tests/table.spec.ts`: the description reads the Move's line; the line itself `actionDescriptions.spec.ts`; the being-decided outline `discDraft.spec.ts`; a jump from the log `historyLog.spec.ts`, browser `tests/history.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosBoard.spec.ts`, from real play: two steps back to the Move, no panel and no lit target, the voyage space outlined as being decided, enlarge and open seat changing nothing
- S62: automated (browser at desktop and phone by named fixture, `tests/scenariosBoard.spec.ts`, from real play: a Migrate as the first of two cards, then Move steps 1 and 2 and a pilfer; Undo pops the pilfer, step 2, step 1, the card, then the Migrate, then hides at the round's barrier)
- S63: automated (`flightLayer.spec.ts`: the 200 ms bound, a step in history, a reconnection with nothing on the layer, frames captured on the desk; browser `tests/flightLayer.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMotion.spec.ts`, by duration inspection: Undo of a sent Move and each history step move the pieces and finish within 200 ms, with 50 ms for frame timing; an Action the page never heard, then a reconciliation, changes the board with no frame of motion; open: Manual, for a person at desktop and phone width to undo a Move and step backward and forward in history and judge that each reads as one quick slide, and to drop and restore a real connection mid-game and see the state appear with no motion
- S64: automated (`historyLog.spec.ts`: the span, its stop and the way back, nothing sent or hidden shown; browser `tests/history.spec.ts`, frame by frame: a Move along its route then the pilfer; a dawn's epoch marker and score disc; browser at desktop and phone by named fixture, `tests/scenariosMotion.spec.ts`: a turn's replay walks the pawn, the pilfer after its arrival, nothing hidden, and the table back where it was); open: Manual, for a person at desktop and phone width to replay a turn entry with a Move and a pilfer and a dawn from the History tab, and judge that the steps read along their routes, then the pilfer, that the epoch marker and score discs move, and that the table returns to where it was
- S65: automated on the board (`boardAnimators.spec.ts`; browser `tests/boardAnimators.spec.ts`; the flight layer `flightLayer.spec.ts`, browser `tests/flightLayer.spec.ts`; the log line compared moving and still, browser `tests/boardAnimators.spec.ts`); browser at desktop and phone by named fixture, `tests/scenariosMotion.spec.ts`: with reduced motion each flight holds one position and the pawn jumps with no step between, in the order the moving run takes, and the log line is the same; open: the panels' tokens, for a person with reduced motion on to send a Move with a pilfer and see the seat panel's goods change with no tween
- S66: automated (`flightLayer.spec.ts`: a second Action is queued behind the first's flight, then the layer is empty and nothing hidden; browser `tests/flightLayer.spec.ts`, every frame checked); browser at desktop and phone by named fixture, `tests/scenariosMotion.spec.ts`: another seat's Action sent at the first frame of a Move's motion, then no flight, no transient and nothing hidden, and the board as a fresh page draws it
- S67: automated (`boardFocus.spec.ts`; browser `tests/phone.spec.ts`, 375 × 812 and 812 × 375); browser at desktop, 375 × 812 and 812 × 375 by named fixture, `tests/scenariosPhone.spec.ts`: the four chips over the Map, a Move pick framed in view, a hand pan by touch (touch start, moves, end) clearing it, the guild pick framing the West with the East chip's lit dot; at the desk no chooser and every lit target in view
- S68: automated (browser `tests/phone.spec.ts`; browser at desktop and phone by named fixture, `tests/scenariosPhone.spec.ts`: a Merchant pull's bench as a bottom sheet with the result and primary in its footer, the desk's bench over the board with its primary in the panel; the eleven-card draft in two rows with the pouch and finalise line under them; no sideways scroll); open: in a 652 px column the cap is 14 px short, so the second row's magnifier is 35 px until the panel is scrolled; the Knight rows' presses reach 44 px at 1440 × 900 and 390 × 844 (`tests/desktop.spec.ts`, `tests/phone.spec.ts`), with the art and without it, except a row with a pressing row on each side, which keeps its own column; the bench's other printed places are under 44 px
- S69: automated (browser `tests/phone.spec.ts`; browser at desktop and phone by named fixture, `tests/scenariosPhone.spec.ts`: another seat's chip and the own seat's chip each open the seat as a sheet, a card in it enlarges above the sheet, nothing standing over it, and Escape closes one, then the other; at the desk the seats stay in their column)
- S70: partly automated (browser at desktop and phone by named fixture, `tests/scenariosPhone.spec.ts`: Enter full screen makes the dialog modal; the action panel, the guild's popup and its bench open inside it; the send reaches the server and full screen stays); open: Manual, for a person at desktop and phone width in a real browser window to enter full screen, play a guild function through its bench to the send, and check that the panel sits in the toolbar and that nothing opens behind the dialog
- S71: automated (`palette.spec.ts`; `faces.spec.ts`: a rose chip's label and halo, on the board and in flight, a seal and a bead with no halo; browser at desktop and phone by named fixture, `tests/scenariosPalette.spec.ts`: every chip of an open pick, the ferry's rose chip among them, carries a label over the halo; a seal on the board and in a panel keeps its crown with no halo and no chip)
- S72: automated (`boardGeometry.spec.ts`; browser at desktop and phone by named fixture, `tests/scenariosPalette.spec.ts`: the drawn board holds a location disc for each space of the logic's data and no other, each route when the map is drawn in code, and the 150 score spaces)
- S73: automated (browser `tests/phone.spec.ts`; browser at desktop and phone by named fixture, `tests/scenariosPhone.spec.ts`, from real play: a voyage-disc pick frames the voyage space on the board; the Tracks chip opens the sheet with every track, text at least 11 px, scrolling inside, no lit target in it; Escape gives back the framed board with the pick open; at the desk no chooser and the voyage track in view)
