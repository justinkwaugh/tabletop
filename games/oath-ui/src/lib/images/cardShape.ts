import { CardKind, kindOf } from '@tabletop/oath'

// Width over height, by kind. The source art: `backs/denizen.jpg` 651:1016,
// `backs/site.jpg` 1313:1016, `backs/relic.jpg` 1:1.
export const CARD_ASPECT: Readonly<Record<CardKind, number>> = {
    [CardKind.Denizen]: 651 / 1016,
    [CardKind.Vision]: 651 / 1016,
    [CardKind.Relic]: 1,
    [CardKind.Site]: 1313 / 1016
}

// A Vision's front is printed landscape (1016 x 651); its back is portrait.
const VISION_FRONT_ASPECT = 1016 / 651

export interface CardFace {
    cardId?: string
    back?: CardKind
}

// R-9.4 — a facedown card is sized by its back; the id is not consulted.
export function cardAspect(face: CardFace): number {
    if (face.back !== undefined) return CARD_ASPECT[face.back]
    const kind = face.cardId ? kindOf(face.cardId) : undefined
    if (kind === CardKind.Vision) return VISION_FRONT_ASPECT
    return CARD_ASPECT[kind ?? CardKind.Denizen]
}

export function widthAtHeight(height: number, options: CardFace): number {
    return Math.round(height * cardAspect(options))
}
