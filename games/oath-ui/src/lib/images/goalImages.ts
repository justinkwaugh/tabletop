import type { GoalKind } from '../model/goalBoard.js'
import { goalFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName } from './manifestIndex.js'

// Traced from the goal tiles' printed marks; the Grand Scepter drawn to its small mark.
const goalsByName = indexByName(goalFiles)

export function goalSymbolImage(kind: GoalKind): string {
    return imageNamed(goalsByName, kind)
}

export function goalSymbolKeys(): string[] {
    return [...goalsByName.keys()]
}
