# Known deviations

Where this implementation still differs from the Law of Oath or a card's published Q&A. The code
cites the Law as `R-<section>`; `docs/rulings.md` holds the house rulings, which are readings, not
deviations. Each line names the card or rule, what the engine or UI does, and what governs.

## Card powers

- **Vow of Silence, Vow of Renewal:** they also block a Campaign's banner target, which is a Seize (R-10.23), not the Recover the cards forbid.
- **Vow of Silence:** its holder gains the secrets paid for the Darkest Secret, not the number placed, so Magician's Code's two are missed.
- **Small Friends:** the modifiers at the pawn's own site stay usable, and those at Beast sites are opened without being declared.
- **Secret Signal:** refused under Careless when trading for secrets; its Q&A allows it.
- **Mushrooms with Augury:** the draw depends on the order the two are declared; the Q&A says two are drawn.
- **Dragonskin Drum:** fires only on a Travel action, not on travel a power causes; its Q&A counts that travel.
- **Giant Python:** counts the Oathkeeper's dice and ignores a Chancellor's ally holding Python; its Q&As say otherwise.
- **Rusting Ray:** "you hold the Darkest Secret" is read as its user alone, not the user's side (R-10.28-H1).
- **Book Burning:** leaves facedown secrets; its Q&A burns them face up or down.
- **Sticky Fire:** takes effect over Billowing Fog (R-9.2).
- **Cursed Cauldron:** counts only the defeated side's kills, Hospital-saved warbands included; its Q&A also counts Bear Traps and skull kills.
- **The Grand Scepter:** one received in an exchange is locked for the turn; its Q&A lets it be used.
- **Obsidian Cage:** warbands of an Exile who has since become a Citizen return as that player's own; the Q&A makes them Imperial.
- **Revelation:** asks from the player who played it; the Q&A starts from the Chancellor.
- **Gambling Hall:** the favor bank is chosen before the roll.
- **Witch's Bargain:** deals with one player per use; the Q&A allows several.
- **Land Warden:** the second card played gets no When Played choices, no Deep Woods or Wastes relic, and cannot use a space freed by Crop Rotation or the Great Slum. A When Played power that draws a hidden card (Family Heirloom, Pilgrimage, the citizenship relic takes) is not resolved for it, and the action records that in `secondWhenPlayed`; the table offers only the second plays the engine accepts.
- **Marriage:** counts as two Hearth advisers only in a Trade, not for the Conspiracy's match or Military Parade.
- **Salad Days:** accepts an empty favor bank (R-7.1.3).
- **Saddle Makers:** pays after the When Played power; its Q&A pays before.
- **Deed Writer:** lets a Citizen and the Chancellor exchange sites, and refuses a Bandit Crown holder with no warbands; its two Q&As say otherwise.
- **The Gathering:** asks from the acting player, not the Chancellor (its Q&A), and its exchange can move locked advisers (R-7.2.2).
- **The Tribunal:** its exchange binds what changes hands at once, not promises of later actions (R-7.6.3-H1).
- **Vow of Kinship:** Nomad-bank favor is always put into the People's Favor Wake, and Plague Engines and Dissent force it too; its Q&A makes it optional.
- **Forced Labor:** not charged for an R-6.1 play or Oracle's draw; both Q&As charge it.
- **Wild Mounts:** never applied for the bandits (R-5.5.3-H1 and its Q&A).
- **Military Parade, Battle Honors:** do nothing when the bandits win; the cards burn them.
- **Relic Hunter:** cannot put on the bottom a relic the defender held; only relics taken from sites.
- **Encirclement:** counts only the attacker's board, not the whole force.
- **Wrestlers:** the engine picks the sacrificed warband, and an ally's board is never offered.
- **Martial Culture:** "may become a Citizen" is decided before the roll.
- **Buried Giant to The Hidden Place:** one flipped secret pays both flips.
- **Decadent:** its +1 is added after "spend no Supply", so Tents, A Fast Steed, Special Envoy, Portal and a Buried Giant flip still cost 1 (R-7.6.2).
- **Great Crusade:** counts only its user's own cards, not the side's (R-10.28-H1).
- **Master of Disguise:** the engine accepts the other player's Trade modifiers, but the modifier picker does not list them.
- **Warning Signals:** warbands moved from the board all go to one site per use.
- **Toll Roads:** never asked or paid on travel a power causes (a banish, the Whistle, Palanquin's carried player, Brass Horse).

## Rules

- **R-6.6.2, R-6.6.3:** a Citizen who gains warbands through a power gets their own, not Imperial ones; Muster already gives Imperial ones.
- **R-9.4:** the state publishes each facedown adviser's back (`vision: true` on a Vision's row) and the number of Visions in each hand (`handVisions`), but the table still draws every other player's facedown adviser as a denizen back and shows a hand as a count, so a facedown Vision looks like a denizen there.
- **R-9.4:** a discard pile publishes only its top card's back and its count, not every back.

## Not checked by specs

- **R-4.3.3, R-2.1.6, R-5.5.4:** the refresh bands on the player boards, the Visions Drawn search costs printed on the board and the dice faces are pinned by specs as transcribed; no spec checks the transcription against the printed components.
- **R-X.3:** the undo bounds around an information-revealing Action, simultaneous groups and an administrator's bypass are the platform's (its backend service specs); Oath declares no simultaneous groups, and its own specs cover undo across a let-peek.
