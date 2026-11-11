# Rules interpretations

Königrufen follows the Austrian rules as Pagat (pagat.com) and the German and English Wikipedia articles describe them. Where those sources differ, are silent, or leave a choice to the table, the implementation makes the choices below. Each is covered by tests in `src/definition/*.spec.ts` or `src/model/*.spec.ts`.

## Dealing and the auction

- **Four players, anticlockwise.** The last seat deals the first hand, so the first seat is Forehand. Six cards to each player, six face down to the talon, then six more to each. A game is two to five times around the table (configurable, three by default).
- **Contract order** follows Wikipedia's auction order (Austrian Final / Hausruckviertel), with Pagat's Zwiccolo and Farbendreier fitted in by value. Sechserdreier ranks above the Dreier of equal value.
- **Forehand opens with "Mein Spiel" or Sechserdreier.** Rufer and Trischaken are only named by Forehand after "Mein Spiel" is passed out. A player seated earlier may hold a bid at the same rank; anyone else must bid higher.

## Besserrufer (house rules)

- **The bird is named in the bid**, before the next player bids: Besserrufer Pagat, Uhu, Kakadu or Quapil.
- **Its value is the game (1) plus the bird's announced value**: Pagat 3, Uhu 5, Kakadu 7, Quapil 9. Quapil outranks Solodreier (8).
- **It ranks with the contract of the same value** (Pagat with Farbendreier, Uhu with Farbensolo, Kakadu with Bettel Ouvert), as a tie: an earlier seat may hold it, anyone else must bid higher. Without a contract of that value it ranks just above the most valuable one below it.
- **The bird is announced for the declarer's side** when announcements open; the defenders may Kontra it.
- **Giving up** with the called King in the talon pays the game plus the named bird in full to each opponent (the Spieleversum convention). Only that bird counts: the talon is settled before any other announcement, so no Kontra and no other bonus can have been said, and no card is played.

## The called King in the talon

- Declarer either gives up, paying the game to each opponent, or takes a half and plays alone against three; Kontra is not allowed then (Wikipedia).
- In Solorufer the untouched talon counts for the opponents unless the called King is in it; then that half belongs to the declarer (Wikipedia).
- With three Kings declarer may call "the fourth King" without naming its suit; with all four there is no King to call.

## Laying away

- Kings and the Trull may never be laid away; other trumps only when no suit card can be, and trumps laid away are shown face up.

## Play

- **Negative games and Trischaken**: beat the highest card so far if possible, and play the Pagat only as the last trump. Declarer leads in the negative games; Forehand leads in Trischaken. A negative game stops as soon as declarer has failed.
- **Ouvert games** lay every hand open once a card has been led to the second trick (Pagat).
- **Colour games** (Farbendreier, Farbensolo): trumps do not beat the suit led, may not be led while the leader holds a suit card, and are held back while suit cards remain.
- **An announced bird** is kept for its trick unless nothing else may be played (Wikipedia).

## Scoring

- **Bonuses** follow Wikipedia's Austrian table, silent / announced: Trull, Four Kings, King ultimo and Pagat 1 / 2, Uhu 2 / 4, Kakadu 3 / 6, Quapil 4 / 8; Valat multiplies the game by 4 / 8 and replaces it and every other bonus. Kontra, Re and Sub each double.
- **The Sack** (house rule) is announced only, worth 2: the announcing side takes 46 or more card points.
- **Solorufer and Solodreier** double every bonus but Valat (Pagat). Negative games score no bonuses; Farbensolo scores only Valat.
- **Trischaken**, each for themselves: the two with the most card points pay one each to the two with the fewest; anyone with 36 or more pays two to each other player; anyone without a trick is paid two by each other player. The payments add up. When the second and third highest totals tie, the payment between the two highest and the two lowest is skipped. The winner of the last trick takes the talon.
- **The game ends** after the chosen number of times around; the highest score wins, and a tie for highest is a draw between those players.
