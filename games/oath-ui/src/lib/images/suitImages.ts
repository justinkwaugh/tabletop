import type { Suit } from '@tabletop/oath'
import { suitFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName } from './manifestIndex.js'

// Traced from the suit discs printed beside the board's favor banks.
const suitsByName = indexByName(suitFiles)

export function suitImage(suit: Suit): string {
    return imageNamed(suitsByName, suit)
}

export function suitImageKeys(): string[] {
    return [...suitsByName.keys()]
}
