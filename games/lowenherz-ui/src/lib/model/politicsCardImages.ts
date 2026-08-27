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
import cardBackImg from '$lib/images/politics-cards/card-back.jpg'

// The one shared face-down image, used by PoliticsCard for every card shown faceDown - exported
// so PoliticsCard doesn't need its own separate import of the same file.
export { cardBackImg }

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

// Resolves once the browser has actually finished decoding this image - not just fetched it.
// img.decode() is what guarantees that (the 'load' event can fire before decode work off the
// main thread is done); falls back to load/error for the rare browser without decode(). Never
// rejects - a failed decode should let a caller proceed anyway rather than hang waiting on an
// image that will never come.
function decodeImage(src: string): Promise<void> {
    const img = new Image()
    img.src = src
    if (typeof img.decode === 'function') {
        return img.decode().catch(() => undefined)
    }
    return new Promise((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
    })
}

// Resolves once this card's own face art is decoded. Resolves immediately for a card with no
// face image (an unrecognized value - see politicsCardFaceImage).
export function preloadPoliticsCardFace(card: PoliticsCard): Promise<void> {
    const src = politicsCardFaceImage(card)
    return src ? decodeImage(src) : Promise.resolve()
}

// Resolves once the shared face-down art is decoded - PoliticsDeckChooser's own deck backs need
// this same wait (see that component's own comment): the card backs used to just render
// immediately, with nothing checking whether the browser had actually decoded that image yet
// the very first time a politics phase came up in a session, which is the same white-flash bug
// preloadPoliticsCardFace exists to prevent for the face-up cards.
export function preloadPoliticsCardBack(): Promise<void> {
    return decodeImage(cardBackImg)
}
