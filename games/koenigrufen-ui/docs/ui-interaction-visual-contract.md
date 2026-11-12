# Königrufen UI interaction visual contract

## Visual intents

### Seats

- **Order:** I sit at the foot. The other seats follow turn order clockwise on screen: the next to play on my left, then the top seat, then my right. The rules' table runs anticlockwise, but play on screen goes clockwise (user's choice), and the trick's places follow the seats.

### The table on phones

- **Trigger:** the viewport is 640px wide or less.
- **Shape:** the table is 740 board pixels wide and as tall as the shape of the room under the action area allows (780 to 1300), so it fills the width and nearly all the height. Its height follows the room as the action area grows or shrinks.
- **Hand:** one row of larger cards (124 board pixels) across the table's foot, overlapping so each card's left edge and index stay in view.
- **Middle:** the side seats sit just below the top seat. The trick centres on the room between them and the hand and grows into it, up to 1.5 times while it would reach the side seats and up to 1.8 times once it is below them. The talon in the middle grows to at most 1.1 times, and sits low enough to clear the side seats.
- **Zoom controls:** top right, clear of the hand (bottom left on wider screens).

### The table on larger screens

- **Trigger:** the viewport is wider than 640px.
- **Fit:** the 1200×860 table fits the room under the action area inside a margin (12px above, 16px at the sides and below) and grows past its natural size up to 1.5 times, so a large monitor shows it bigger without it reaching the edges (at 2560×1277 it is about 1365×978). Zooming in stops at 1.5 times too.

### Depth

- **The felt:** a radial gradient that darkens towards the edge; there is no inset shadow.
- **Shadows:** cards, card backs, name plates, the called-King chip, player panels and the menus cast unblurred offset shadows (a 1px edge under a card, deeper under a raised card or a menu). The winning card's blue edge has a soft 2px halo drawn as a solid ring. A hand card's rise is its only animated change; its shadow and dimming switch at once. Blurred shadows made the table repaint for about 400ms on a phone.

### Short names

- Cards are written as rank then suit (K♠, 10♥, Q♦); trumps as their pack prints them (21, or XXI with Industrie und Glück), the Sküs by name. A called king is K♠, or "4th K" for the fourth king. The header reads "Hand 1/12".
- **Called King:** wherever the table names the contract for everyone (the header from the call to the end of the hand, and the "Contract:" line during announcements), the called King follows the word "called" as a card-coloured chip: cream with a thin border and shadow, bold and a little larger than the text around it, red for ♥ ♦ and black for ♠ ♣ and "4th K". Its accessible name is "the King of hearts" or "the fourth King". While the declarer calls, each King on offer is a button drawn as that chip, a little larger, rising on hover and ringed in gold on keyboard focus; its accessible name is "Call the King of hearts".
- A seat's won cards are a pile and a number, with no word; the words ("8 cards won") are in its tooltip and accessible name.

### Looking at a hand card

- **Trigger:** the keyboard has moved focus to a card in the player's hand, or (without that) a card is picked to play. Keyboard focus opens any card, legal or not, at any time: a card that cannot be chosen is still focusable, marked `aria-disabled`, and activating it does nothing. Hovering with the mouse does not open a card or move the hand.
- **Display:** when the hand overlaps, that card opens until 80% of its width shows, so its picture can be seen as well as its index, and every other overlapped card closes up evenly to make room, so the row keeps its width. A hand that already shows that much of each card does not move. The cards slide (0.12s); nothing else on the table changes.
- **Pointer stability:** a card only ever gains width as it opens, and its neighbours give way on the far sides, so the card under the pointer stays under it: the first click or tap picks and opens the card, and a second on the same spot still lands on it and plays it.

### Playing a card

- **Trigger:** it is the viewing player's turn in play.
- **Emphasis:** the legal cards in their hand get a gold outline and lift on hover. The other cards in the hand are dimmed.
- **Picking:** a click or tap on a legal card raises it with a green outline, and the action panel asks for a second click. Picking another legal card moves the pick to it. Undo drops the pick.
- **Commit by click:** a click or tap on the raised card plays it.
- **Commit by drag:** pressing a legal card and moving it more than a few pixels drags it with the pointer, above the rest of the hand. Releasing it anywhere on the table above the player's own name plays the card; releasing it at or below the name slides it back into the hand and plays nothing. The drop zone is not highlighted. A drag never counts as a click, so it does not pick the card.
- **Unaffected:** the talon and the seats.

### Choosing cards to lay away

- **Trigger:** it is the declarer's turn to lay away after taking talon cards.
- **Emphasis:**
    - Cards that may still be chosen get a gold outline.
    - Chosen cards rise and get a green outline.
    - Every other card is dimmed.
- **Action panel:** shows the count chosen against the count needed, and the contract's rule: ordinarily that Kings and the Trull stay and trumps go only when nothing else can; in Farbendreier that trumps go first, never Kings or the Trull, and that suit cards are shown. **Lay away** is enabled only when the count is complete.
- **Changing the choice:** choosing a chosen card again takes it back out. Undo takes back the latest chosen card.
- **Commit:** only **Lay away** commits.

### Choosing a contract

- **Trigger:** it is the viewing player's turn to bid, or to name the contract after “Mein Spiel”.
- **Bidding row:** the action area offers only **Bid ▾**, **Mein Spiel** (forehand's opening turn, with its meaning in a small line below) and **Pass** (when passing is allowed). **Mein Spiel** and **Pass** act at once.
- **Menu:** **Bid ▾** opens the biddable contracts in a table under the button row, across the action area (up to 1040px wide). It covers the top of the table but stops above the player's hand, so the hand stays in view; only when less than 160px is left does it run over the hand. A tap or click outside, **✕** or Escape closes it; choosing a bid closes it and bids. Naming after “Mein Spiel” uses the same menu behind **Name contract ▾**, already open when the turn starts. The menu follows its button on resize and scroll, and each opening starts with no bid previewed.
- **Rows:** one row per contract, cheapest first, in plain words: value (win and loss when they differ, Sechserdreier `4/−8`), contract, teams ("2 v 2", "1 v 3", "None" for Trischaken), goal ("36+ card points", "Exactly 1 trick"), talon ("Take 3", "To defenders", "Last trick", "Unused") and rule tags ("No bonuses", "Bonuses ×2", "No trumps", "Only Valat and Four Kings", "Open hands", "Opening only", "Names a bird"). No symbols, pips or glyphs.
- **Forehand's opening bid:** Sechserdreier heads the table, its row tinted gold and its name gold. Next come Rufer and Trischaken, greyed and tagged "After Mein Spiel": pointing at one or tapping it shows its description with "Say Mein Spiel first." but never bids. A gold rule separates them from the ordinary bids, cheapest first. Once "Mein Spiel" is said, Sechserdreier is no longer offered, and when it is passed out, Rufer and Trischaken are named in rank order like any other contract.
- **Besserrufer:** one row for every bird, placed where its cheapest open bird ranks, its value the range of the open birds ("3–9"; "7–9" over a Besserrufer Uhu). Its birds are the bids: Pagat 3, Uhu 5, Kakadu 7, Quapil 9 (the game plus the bird's announced value), each a button with its total; birds the player may not bid stay visible, dashed and disabled.
- **Wide menu (800px and up):** the table sits beside a pane. Pointing at a bid with a mouse, or focusing it from the keyboard, shows its name, value and description in the pane; clicking a bid makes it. Clicking Besserrufer holds the pane on it, listing the four birds one per line with each bird's goal, so the pointer may cross other rows on the way. The pane is empty until a bid is shown, with no instructions.
- **Narrow menu (phones):** each bid takes two short lines: value, contract, teams and a short goal ("36+ points", "1 trick"), then "Talon: …" and the rule tags. The pointed-at or tapped bid unfolds its description beneath it; Besserrufer unfolds its bird buttons in a row.
- **Touch:** without hover, the first tap on a bid shows it (pane or unfold) and a second tap bids; only then does the wide pane say "Tap again to bid." A tap's own enter and focus events never count as a preview.
- **Phones:** below 640px every choice button in the action area (**Bid ▾**, **Mein Spiel**, **Pass**) is smaller.
- **Highest bid:** while bidding goes on, every player sees a "Highest bid:" line under the action panel naming the holder, the bid with its value ("Besserrufer Uhu (5)") and a one-line summary of what it takes. It is absent until someone bids.
- **Called King in the talon:** the declarer sees **Give up** beside the two halves, with a line pricing both ways: giving up pays the game to each player, plus the named bird for a Besserrufer ("pay 5 to each player (game and Uhu)"); playing alone wins or loses the game from each, the bird still announced. The hand summary then lists the bird as announced and lost.

### Announcing

- **Trigger:** it is the viewing player's turn in the announcements, after the talon is settled (every contract but Trischaken).
- **Menu:** **Announce ▾** opens a table of the choices in the same menu as the bids (under the button row, stopping above the hand), already open as each announcement turn starts. A tap or click outside, **✕** or Escape closes it; **Announce ▾** opens it again with the ticks kept.
- **Table:** a "Bonuses" section for the bonuses the player may announce for their side, with labelled columns: a tick box, the bonus, its announced value (gold; doubled in Solo contracts, Valat as the game times eight), its silent value (blank when it scores only announced), and on wide menus its goal. Then a section per double word on offer, Kontra, Re or Sub, each with a note on what it doubles, listing what it raises ("Game", "Game with Anna", "Trull") with its value now and doubled. A row toggles its tick; ticked rows are tinted gold. A Besserrufer's bird, named with the bid, is already announced when the round opens.
- **Description:** on wide menus a pane beside the table describes the row pointed at with a mouse or focused from the keyboard ("Trull (2): Take Pagat, Mond and Sküs. Worth 1 unannounced."; "Kontra on the game: Doubles the game: worth 1 now, 2 after Kontra."). On narrow menus the row unfolds the same text in place. Without hover, a tap toggles the row and shows its description.
- **Confirming:** the menu's foot holds **Pass**, or **Announce Trull · Kontra Game** once something is ticked. Outside the menu, the prompt line lists what is ticked ("Chosen: Trull") and the action panel's own button reads **Pass** or **Announce**.
- **Phones:** the narrow menu keeps the tick, the name and both values on one line per row.
- **Contract line:** during announcements every player sees a "Contract:" line under the action panel naming the declarer's contract with its value and the same one-line summary as the "Highest bid:" line, so bonuses and Kontras are weighed against it.
- **Everyone:** what each player has said this hand is on their player panel ("Said Pagat · Kontra on the game"), not in the action area.
- **Play:** a card that an announced bird of the player's side needs (Pagat, Uhu, Kakadu, Quapil) is not offered before its trick, unless nothing else may be played.

### Player panels

- **Motif:** a page of a Tarock score pad on card stock, ruled with a faint line under each entry, the player's colour as the header band.
- **Header:** the name, then Dealer and Forehand; the player to act has a gold "Turn" tag and a thicker gold edge.
- **Tally:** the score, and beside it the last four hands' changes, oldest first, the latest bold, green for a gain and red for a loss.
- **This hand:** where the player stands (during the auction their held bid "Bids Dreier", "Passed" or "Mein Spiel"; after it "Declarer · Rufer", "Partner", "Defender", or on my own panel "Secret partner"), with "9 in hand · 4 won" on the same line. A side shows only once the table knows it: declarer playing alone, the called King played, or an announcement for a side. Trischaken shows no sides.
- **Said:** the bonuses and doubles the player announced this hand, in the history's words.
- **No play aids:** nothing a player could work out from play (voids, birds still out).
- **Source:** `panelFacts.ts`, tested in `panelFacts.spec.ts`; the seat badges on the table stay as they are.

### Hand summary

- **Trigger:** a hand has ended and the next auction is running, or the game is over.
- **Display:** a panel in the middle of the table shows the contract, the declaring side's card points against the opponents' (for a negative game, the declarer's tricks, and a note when play stopped early; for Trischaken, every player's card points and tricks, with no made/lost verdict or score-sheet mark), what the contract needed, whether it was made, a line for any Kontra on the game and for every bonus scored, each a short phrase ("Declarer made Trull", "Defenders announced and lost Pagat (Kontra)") beside its points to that side, and a score sheet with a row per hand and a total row. The latest hand is highlighted and scrolled into view.
- **Closing:** the × hides the panel until the next hand ends. This is per viewer and lasts only for the page.
- **Phones:** the panel moves up over the seats and is a little larger, its height following the table's, so the hand stays clear.

### The talon on the table

- **Dealt:** face down in the middle of the table (where the trick will be) until the contract has used it, as two piles of three side by side, the halves it turns up into. A face-down talon waiting in the upper left is split the same way.
- **Turned up:** a contract that exposes it (Rufer, Besserrufer, Dreier, Farbendreier) turns it up in the middle as two halves side by side, larger than in the corner.
- **Choosing:** on the declarer's turn both halves get a gold outline and are each one click or tap target.
- **Before play:** the talon goes where it belongs, and nothing of it stays in the middle:
    - cards the declarer takes (the chosen half; all six in Sechserdreier) into the declarer's hand;
    - cards for the defenders, when declarer plays alone against three (the other half in Dreier and Farbendreier, and in Rufer when the called King was in the talon; the whole talon in Solodreier and Farbensolo), to the first opponent after the declarer, who gathers them;
    - cards for no team yet to the upper left, where they wait for the hand: Rufer's and Besserrufer's other half face up (the partner is secret), and the face-down talon in Solorufer, Trischaken and the negative games.

### Open hands (ouvert)

- **Trigger:** in Piccolo Ouvert or Bettel Ouvert, a card has been led to the second trick (the state's `handsShown`).
- **Display:** each other seat shows its hand face up, sorted like the viewer's own, as small overlapped cards in place of the card backs; on phones the side seats use two rows. The viewer's own hand is unchanged.
- **Ends:** with the deal of the next hand.

### The trick just won

- **Trigger:** a trick's fourth card is played.
- **Display:** once the fourth card lands, all four cards stay at full brightness, the winning card gets a thin blue edge, and a caption names the winner. After one second the trick slides to the winner's trick pile, and the table is empty for the lead.
- **Capture piles:** each seat shows how many cards lie face down in its capture pile, a large number beside a pile 18×27px: a dashed outline until its first card, then a face-down card in the backs' dark blue (a stack once it holds more than a trick). The pile shows from the first lead, or earlier once it holds cards. A card counts when it is face down in a capture pile (user's rule): every card of a won trick, the declarer's cards laid away face down (not those shown face up), and the talon cards the defenders' collector gathers. Cards waiting in the upper left do not count. `wonCards.ts` holds the rule, tested in `wonCards.spec.ts`; the player panel shows the same number ("12 in hand · 8 won").

### Card motion

- **A card played:** it flies from where it was held (my hand's slot, wherever a drag dropped it, an open hand's card, or the last card back of another seat) to its place in the trick, upright at first and turning into its place's lean as it lands (0.42s). The card leaves the hand as it sets off. The trick shows no winner until the card lands.
- **A won trick leaving:** the fourth card's own play: the card lands (0.42s), the blue edge and caption fade in, the trick holds for one second, then its cards slide one after another to the winner's trick pile, shrinking to the pile's size without fading on the way (0.5s each), and vanish into it. The last trick of a hand goes the same way before the hand summary shows.
- **The deal:** after the last hand's trick has gone, the new hand leaves the dealer's seat in packets of fanned backs, in Pagat's order: one to each player in turn order from the dealer, one to the talon, then one to each player again (about 1.4s). Packets land on the seats, in my hand at hand size, and on the talon; the state swap then shows the hands.
- **The talon turning up:** the six cards slide out of the face-down stack in the middle to their places in the two halves, then each turns face up (narrowing to an edge and opening again), one after another (about 1s).
- **The talon leaving the middle:** cards for the declarer fly into the declarer's hand (mine: growing to hand size; another declarer's: onto their seat's backs), the chosen half first; cards for the defenders fly to their gatherer's seat; cards that wait glide to the upper left, shrinking to its size. A face-down talon moves as backs.
- **Laying away:** my laid-away cards fly from my hand to my name plate, shrinking and fading. Another declarer's seat lets that many backs rise and fade.
- **Undo and history steps:** a single card arriving in the trick flies in 0.2s; everything else, including a card taken back, changes at once. Replaying history plays the full motion. With reduced motion, every change is the fast one, and the deal and talon do not move.
- **Interaction:** none waits on the motion beyond the session's own busy state, since the next player's turn starts when the state swaps after the motion.

## Coexistence and precedence

- Playing a card, choosing cards to lay away and taking a talon half belong to different machine states, so no two of them can be reachable at once.
- **Motion and the hand summary:** the last trick goes to its winner before the summary appears, and flying talon cards pass under the summary's layer.
- **The talon and the trick share the middle:** the talon leaves the middle before play starts, so the two never show together. The hand summary covers the next hand's talon during the auction until it is closed.
- **The hand summary and the trick never share the table:** the summary shows only during an auction or after the game ends, when the trick area is empty.
- **The trick just won and the next lead:** the next player can act only after the won trick has reached its pile, so a lead always starts on an empty table.

## Shared visual state

### Lay-away selection

- **Meaning:** the cards chosen so far to lay away, one staged-selection stage per card, all `manual`.
- **Producer:** the session (`toggleLayAway`).
- **Consumers:** the hand (chosen and choosable emphasis) and the action panel (count, **Lay away** enabled).
- **Lifetime:** cleared whenever a new state is presented. Undo pops the latest card.
- **Validity:** applies only while the viewing player can lay away. Otherwise the session derives an empty selection. History View never shows it, because no player can act there.

### Announcement selection

- **Meaning:** the bonuses and doubles chosen so far for this announcement turn, one staged-selection stage per choice, all `manual`.
- **Producer:** the session (`toggleAnnouncement`).
- **Consumers:** the announcement menu's tick boxes and foot button, and the action panel's "Chosen:" line and **Pass** or **Announce** button.
- **Lifetime:** cleared whenever a new state is presented. Undo pops the latest choice before any action undo.
- **Validity:** the session keeps only choices still on offer to the viewing player.

### Card picked to play

- **Meaning:** the legal card picked by a first click, a single `manual` staged-selection stage.
- **Producer:** the session (`pickOrPlay`).
- **Consumers:** the hand (raised card) and the action panel (second-click prompt).
- **Lifetime:** cleared whenever a new state is presented. Undo pops it before any action undo.
- **Validity:** the session shows it only while it is a legal play for the viewing player.

### Shown trick

- **Meaning:** the trick in play. A won trick is not on the table; its winner has taken it.
- **Source:** derived from the displayed game state, so History View and navigation show the trick as it stood at that step (empty right after a trick is won). The trick animator overrides it with the won trick, winner included, while the fourth card lands and the trick is taken; the next state supersedes the override.

### Flying cards

- **Meaning:** cards and packets crossing the table (the deal, talon copies, laid-away cards), placed in board pixels where they set off.
- **Producer:** `CardFlights`, for the deal and talon animators; cleared after the motion.

### Talon view

- **Meaning:** the talon as the table shows it: face down (two piles of three), two halves in the middle, a waiting half in the corner, or gone; and whether it is in the middle or the corner (`utils/talonView.ts`).
- **Source:** derived from the displayed game state; the talon animator overrides it with the view a transition ends on, so the halves can turn over and waiting cards glide in their new place, and the next state supersedes it. Automated in `talonView.spec.ts`.

### Card style

- **Source:** the viewer's `uniformPips` and `classicDeck` title preferences, saved per account, both off at first. `uniformPips` shows the red 1–4 as red 10 9 8 7, so they rank like the black suits' pips. `classicDeck` swaps in the Industrie und Glück Tarock art as printed, for players who want the traditional pack; it prints no indices but Roman numerals on trumps.
- **Effect:** changes how cards look and how history text names cards for that viewer only, never the game. The only toggle sits in the Players tab, below the player panels.

## Render ownership

- **The card component** is the only renderer of card faces: the Tarot Nouveau as printed, with its court indices R D C V reset as K Q C J in a monoline slab (the Q's tail crosses the bowl and ends in a flat foot, after the Bicycle pack's), cut from the scans by a card-import script kept outside the repository. Under `classicDeck` it draws the Industrie und Glück faces from the same script, with red 10–7 faces composed from the pack's own red pip and laid out like its black spades, and trump II turned so the eagle is on top. Both packs share the Industrie und Glück's printed back. Each pack keeps its own proportion, 229:432 and 239:432, with corners rounded by 7% of the width, and cards of either pack stand equally tall: places are laid out for a 5:9 width, `--card-w`, faces and backs take the pack's share of it, the hand spaces that narrower width, and flights read a card's width from its height.
- **Motion** belongs to the animators in `src/lib/animators/`. A trick card's `fly` wrapper holds only the animator's transform; placement is on the place around it and the lean on the `tilt` inside it. `CardPlaces` is the one registry of where cards are drawn (hand slots, open-hand cards, seats, the talon, the board).
- **Card names in text** come only from `cardLabel` under the same card style, so the history and the table always agree.

## Verification scenarios

Each scenario is checked manually by a Playwright walk through the dev harness, unless marked automated.

1. **Playing:** on your turn in play, only legal cards are outlined, and a click plays the card. A followed suit leaves off-suit cards dimmed.
2. **Laying away:** choose three cards, then choose one again; it drops out and the count falls. Undo removes the latest card without undoing any game action. **Lay away** is enabled only at the full count. Staged-selection behaviour is automated in `stagedSelection.spec.ts`.
3. **Talon:** it lies face down in the middle during the auction, as two piles of three; both halves are outlined in the middle for the choice. After taking one in Rufer, the other half waits face up in the upper left; in Dreier it flies to the first opponent after the declarer; in Solodreier the talon flies there unseen; in Piccolo it glides to the upper left.
4. **Trick just won:** after the fourth card, the four cards stay bright with a blue edge on the winner's and a caption, for one second, then slide to the winner's pile; the seat's count and pile update. The trick diff is automated in `trickMotion.spec.ts`.
5. **Card style:** turning on red 10–7 or Industrie und Glück changes the hand, trick, talon and history names together, and the Players-tab toggle shows the setting. The card gallery at `/cards` in the dev app shows every card in every style.
6. **Two-click and drag play:** one click raises a legal card; a second plays it. Undo drops a pick. A drag released anywhere above the player's name, even at the table's edge, plays the card; a drag released within the hand plays nothing and leaves no pick.
7. **Bid menu:** **Bid ▾** opens the menu above the hand (at 390×844 it ends about 110px above it); an outside tap closes it and a reopened menu has no preview. At 1400×900 the wide table lists every opening bid without scrolling; pointing at a bid fills the pane, and clicking Besserrufer then moving diagonally to Quapil keeps the birds in the pane. At 390×844 the compact table shows; the first tap unfolds a bid and the second bids, and tapping Besserrufer unfolds its birds. After a Besserrufer Uhu the next bidder's Besserrufer row reads "7–9" with Pagat and Uhu disabled. After “Mein Spiel” and three passes the naming menu is already open, Escape closes it and **Name contract ▾** reopens it. Row text is automated in `bidRows.spec.ts`, bid names and summaries in `contractText.spec.ts`.
8. **Hand summary:** after a hand, the panel shows both sides' card points, the requirement, made or lost, and the score sheet whose totals match the player scores (automated in `scoreSheet.spec.ts`). On a phone it does not cover the hand.
9. **Announcing:** the declarer chooses Trull and Pagat and announces; the next player sees a Kontra row with Game, Trull and Pagat, and the declarer's panel reads "Said Trull · Pagat". At 390×844 the choices take at most three lines. After three passes play starts, and the hand summary lists the Kontra and both bonuses. Rules are automated in the logic package's `announcements.spec.ts`, `bonusScoring.spec.ts` and `definition/announcing.spec.ts`; text in `announcementText.spec.ts`.
10. **Card motion:** a played card, a dragged card, the 4th card of a trick and its sweep to the winner, the last trick of a hand and the next deal, the talon turning up, a taken talon half and laying away (Dreier), and the Sechserdreier pickup all move as described, at 1400×900 and 390×844, with no errors. Undo returns a card at once; stepping forward flies it in quickly; Play history replays the motion. The trick diff is automated in `trickMotion.spec.ts`, the deal order in `dealAnimator.spec.ts`.
11. **History:** stepping back into a laying-away position shows no chosen cards or controls, and the trick matches that step.
12. **Phone table:** at 390×844 and 375×667 the table fills the width under the action area, the hand is one row with every index visible, the zoom controls are top right, the talon halves fit inside the table, and the header reads like "Hand 1/12 Rufer · Developer · called K♥", the King in its chip. Text is automated in `cardStyle.spec.ts` and `actionDescription.spec.ts`.
13. **Looking at a hand card:** at 600×900 with a mouse, hovering across the hand moves no card. Picking the fifth card, or reaching it with the keyboard, opens it to 80% while the others close from 42% to 39%, and the row's width is unchanged. On a 390×844 touch phone, a tap opens the picked card and a second tap on the same spot plays it. The spacing is automated in `handSpacing.spec.ts`.
