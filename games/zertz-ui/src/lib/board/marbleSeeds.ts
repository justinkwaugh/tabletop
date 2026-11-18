import {
    assertExists,
    coordinatesToNumber,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import { isCapture, isPlaceMarble, placementSeed, type Ring } from '@tabletop/zertz'

export { placementSeed } from '@tabletop/zertz'

// A marble carries its seed in the state. Only a marble placed before the state kept seeds, in a
// game begun before then, has none; the rest of this file reads its seed from the actions that
// placed and moved it, and can go once no such game is left.
export function marbleSeed(ring: Ring, legacy: MarbleSeeds): number {
    return ring.marbleSeed ?? seedAt(legacy, ring.coords)
}

export type MarbleSeeds = ReadonlyMap<number, number>

// The marbles on the board once the actions before `actionCount` have been made. Each is seeded by
// its action's own number, not its place in the list: a hosted game can open with only its latest
// actions.
export function marbleSeedsAfter(
    actions: readonly GameAction[],
    actionCount = Infinity
): MarbleSeeds {
    const seeds = new Map<number, number>()
    actions.forEach((action, position) => {
        const index = actionNumber(action, position)
        if (index < actionCount) applyToSeeds(seeds, action, index)
    })
    return seeds
}

export function actionNumber(action: GameAction, position: number): number {
    return action.index ?? position
}

export function applyToSeeds(seeds: Map<number, number>, action: GameAction, index: number) {
    if (isPlaceMarble(action)) {
        seeds.set(coordinatesToNumber(action.coords), placementSeed(action.coords, index))
    } else if (isCapture(action)) {
        const seed = seedAt(seeds, action.from)
        seeds.delete(coordinatesToNumber(action.from))
        assertExists(action.metadata, 'A processed capture has its metadata')
        seeds.delete(coordinatesToNumber(action.metadata.over))
        seeds.set(coordinatesToNumber(action.to), seed)
    }
}

export function seedAt(seeds: MarbleSeeds, coords: AxialCoordinates): number {
    return seeds.get(coordinatesToNumber(coords)) ?? coordinatesToNumber(coords)
}

export function textSeed(text: string): number {
    let hash = 0x811c9dc5
    for (let index = 0; index < text.length; index++) {
        hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
    }
    return hash >>> 0
}
