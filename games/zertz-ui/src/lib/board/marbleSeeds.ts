import { coordinatesToNumber, type AxialCoordinates, type GameAction } from '@tabletop/common'
import type { Ring } from '@tabletop/zertz'

export { placementSeed } from '@tabletop/zertz'

// A marble carries its seed in the state. A marble placed before the state kept seeds, or set out
// without one in a scenario, is seeded by its ring.
export function marbleSeed(ring: Pick<Ring, 'coords' | 'marbleSeed'>): number {
    return ring.marbleSeed ?? ringSeed(ring.coords)
}

export function ringSeed(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

// A hosted game can open with only its latest actions, which still carry their own numbers.
export function actionNumber(action: GameAction, position: number): number {
    return action.index ?? position
}

export function textSeed(text: string): number {
    let hash = 0x811c9dc5
    for (let index = 0; index < text.length; index++) {
        hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
    }
    return hash >>> 0
}
