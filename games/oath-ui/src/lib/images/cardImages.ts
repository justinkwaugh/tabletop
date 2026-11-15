import { CardKind } from '@tabletop/oath'
import { cardFiles, backFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName, type SizedImage } from './manifestIndex.js'

// Third-party art, not under the platform's MIT licence; permission to use it is on file with the repository owner.

const byKey = indexByName(cardFiles)

// R-6.6.2.a — a Reliquary trait is offered as a modifier under its own id, and has no card face.
export function cardImage(cardId: string): string | undefined {
    return byKey.get(cardId)
}

/** R-2.9 — an edifice's ruined side is filed beside its intact one, as `<card id>.ruined`. */
export function cardSideImage(cardId: string, ruined: boolean): string | undefined {
    return byKey.get(ruined ? `${cardId}.ruined` : cardId)
}

/** R-2.9 — a card in play by the side that is up. */
export function cardImageInPlay(
    gameState: { isRuined(cardId: string): boolean },
    cardId: string
): string | undefined {
    return cardSideImage(cardId, gameState.isRuined(cardId))
}

export function cardImageKeys(): string[] {
    return [...byKey.keys()]
}

// R-9.4 — the top card's back is public and denizen and Vision backs differ,
// which is what `state.topCardBackType` publishes.
const backsByKind = indexByName(backFiles)

export function cardBack(kind: CardKind): string {
    return imageNamed(backsByKind, kind)
}

/** A denizen's back as a token row draws it (Fallen Spire's count), with its file's size. */
export function denizenBackToken(): SizedImage {
    return { src: cardBack(CardKind.Denizen), width: 282, height: 440 }
}

export function cardBackKeys(): string[] {
    return [...backsByKind.keys()]
}
