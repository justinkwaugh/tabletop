import { Prng, shuffle } from '@tabletop/common'
import { PoliticsCard, PoliticsCardDeck } from '../definition/politicsCards.js'

// Setup: shuffle the 13-card politics deck and deal it into two face-down piles for
// the "Crown and Scepter" action to draw from. The deck has an odd count, so one
// pile ends up with one extra card - which one doesn't matter, so a coin flip (via
// the seeded prng, for determinism) decides which pile gets the larger half.
export function dealPoliticsCardPiles(
    prng: Prng
): { politicsCardPileA: PoliticsCard[]; politicsCardPileB: PoliticsCard[] } {
    const shuffled = [...PoliticsCardDeck]
    shuffle(shuffled, prng.random)

    const half = Math.ceil(shuffled.length / 2)
    const larger = shuffled.slice(0, half)
    const smaller = shuffled.slice(half)

    return prng.random() < 0.5
        ? { politicsCardPileA: larger, politicsCardPileB: smaller }
        : { politicsCardPileA: smaller, politicsCardPileB: larger }
}
