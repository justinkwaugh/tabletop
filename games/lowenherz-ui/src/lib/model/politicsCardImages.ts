import { type PoliticsCard, PoliticsCardType } from '@tabletop/lowenherz'
import allianceImg from '$lib/images/politics-cards/alliance.jpg'
import renegadeImg from '$lib/images/politics-cards/renegade.jpg'
import parchment3 from '$lib/images/politics-cards/parchment-3.jpg'
import parchment4 from '$lib/images/politics-cards/parchment-4.jpg'
import parchment5 from '$lib/images/politics-cards/parchment-5.jpg'
import treasure8 from '$lib/images/politics-cards/treasure-8.jpg'
import treasure10 from '$lib/images/politics-cards/treasure-10.jpg'
import treasure12 from '$lib/images/politics-cards/treasure-12.jpg'
import treasure15 from '$lib/images/politics-cards/treasure-15.jpg'

// One image per value, since every card's number is printed on its own art. Keyed by the value
// the engine deals - politicsCards.ts types them 3 | 4 | 5 and 8 | 10 | 12 | 15 - so a value
// with no art draws nothing rather than the wrong card. Louder than a silent fallback, and
// unreachable unless a deck gains a new value.
const parchmentImages: Record<number, string> = {
    3: parchment3,
    4: parchment4,
    5: parchment5
}

const treasureImages: Record<number, string> = {
    8: treasure8,
    10: treasure10,
    12: treasure12,
    15: treasure15
}

// The single source of truth for "which art shows this card face up" - shared by PoliticsCard's
// own rendering and PoliticsDeckChooser's preload (see that component's own comment on why a
// dealt card can otherwise show blank/white for a moment: the browser hasn't decoded this
// specific image yet, and the deal-in animation gives it far less than a frame to do it in).
export function politicsCardFaceImage(card: PoliticsCard): string | undefined {
    switch (card.type) {
        case PoliticsCardType.Alliance:
            return allianceImg
        case PoliticsCardType.Renegade:
            return renegadeImg
        case PoliticsCardType.Parchment:
            return card.value !== undefined ? parchmentImages[card.value] : undefined
        case PoliticsCardType.Treasure:
            return card.value !== undefined ? treasureImages[card.value] : undefined
        default:
            return undefined
    }
}
