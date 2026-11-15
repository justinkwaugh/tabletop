import { assertExists } from '@tabletop/common'
import { card, isRed } from '@tabletop/koenigrufen'
import { CardArt, UniformRedPipArt } from '$lib/images/cards.generated.js'
import { ClassicCardArt, ClassicUniformRedPipArt } from '$lib/images/classicCards.generated.js'
import { shownPip, type CardStyle } from './cardStyle.js'

// The face in the chosen pack. Under "Red 10–7" the red 1 2 3 4 show as 10 9 8 7: the Tarot
// Nouveau's own, or for the Industrie und Glück pack, which has none, faces laid out from its red pip.
export function cardArt(cardId: string, style: CardStyle): string {
    const found = card(cardId)
    const faces = style.classicDeck ? ClassicCardArt : CardArt
    const redPips = style.classicDeck ? ClassicUniformRedPipArt : UniformRedPipArt
    const uniform =
        found.kind === 'suit' && found.pip !== undefined && style.uniformPips && isRed(found.suit)
            ? redPips[`${found.suit}-${shownPip(found, style)}`]
            : undefined
    const url = uniform ?? faces[cardId]
    assertExists(url, `No art for ${cardId}`)
    return url
}
