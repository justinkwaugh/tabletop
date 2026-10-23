import type { PoliticsCardSource, PoliticsPile } from './politicsCardPiles.js'
import { politicsPileSide } from './politicsCardPiles.js'

// Green and blue rather than red: the player colours include a pink-red and a purple.
const deckColors: Record<PoliticsPile, string> = {
    A: 'rgba(60, 150, 76, 0.7)',
    B: 'rgba(52, 104, 196, 0.7)'
}

// A soft drop shadow in the deck's colour, like the cards' own resting shadow; a card that
// could be from either deck casts green to the left and blue to the right.
export function deckShadow(deck: PoliticsCardSource): string {
    if (deck === 'either') return `-3px 3px 6px ${deckColors.A}, 3px 3px 6px ${deckColors.B}`
    return `0 3px 7px 1px ${deckColors[deck]}`
}

export function deckOutlineColor(pile: PoliticsPile): string {
    return deckColors[pile]
}

export function deckDescription(deck: PoliticsCardSource): string {
    if (deck === 'either') return 'Taken from the left or right deck'
    return `Taken from the ${politicsPileSide[deck]} deck`
}
