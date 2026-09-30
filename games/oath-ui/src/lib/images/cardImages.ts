import { CardKind } from '@tabletop/oath'
import { cardFiles, backFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName } from './manifestIndex.js'

// Third-party art, not under the platform's MIT licence; permission to use it is on file with the repository owner.

const byKey = indexByName(cardFiles)

// R-6.6.2.a — a Reliquary trait is offered as a modifier under its own id, and has no card face.
export function cardImage(cardId: string): string | undefined {
    return byKey.get(cardId)
}

export function cardImageKeys(): string[] {
    return [...byKey.keys()]
}

// R-9.4 — the top card's back is public and denizen and Vision backs differ,
// which is what `state.topCardBackType` publishes.
const backsByKind = indexByName(backFiles)

export function cardBack(kind: CardKind = CardKind.Denizen): string {
    return imageNamed(backsByKind, kind)
}

export function cardBackKeys(): string[] {
    return [...backsByKind.keys()]
}
