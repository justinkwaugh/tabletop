import { Prng, shuffle } from '@tabletop/common'
import { ActionCard, ActionCardDeck, CardBack } from '../definition/actionCards.js'

// Basic-game setup per the rulebook: the A-lettered cards are set aside (they're only
// used with the variable construction rules), and the remaining four lettered sets are
// shuffled *separately* and stacked B-on-top, then C, then D, then E-on-bottom - so the
// draw order is: all of B (in a random order), then all of C, then all of D, then all
// of E last. actionDeck[0] is always the next card to be drawn.
export function assembleActionDeck(prng: Prng): ActionCard[] {
    const order = [CardBack.B, CardBack.C, CardBack.D, CardBack.E]

    return order.flatMap((back) => {
        const group = ActionCardDeck.filter((card) => card.back === back)
        shuffle(group, prng.random)
        return group
    })
}

// Variable-construction setup (player-placed castles): "The game starts with action
// cards lettered A. The action pile is shuffled as in the basic game, except that the
// cards from A are added to the top of the pile." - so the A-lettered set (shuffled on
// its own) draws first, then the same B/C/D/E assembly as the basic game.
export function assembleActionDeckWithConstruction(prng: Prng): ActionCard[] {
    const aCards = ActionCardDeck.filter((card) => card.back === CardBack.A)
    shuffle(aCards, prng.random)
    return [...aCards, ...assembleActionDeck(prng)]
}
