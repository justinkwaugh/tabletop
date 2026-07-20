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
