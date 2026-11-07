import { coordinatesToNumber, type AxialCoordinates, type GameAction } from '@tabletop/common'
import { isCapture, isPlaceMarble } from '@tabletop/zertz'
import { coordsKey } from './geometry.js'

// Each marble's speck seed, so its specks go with it when it jumps. A marble takes its seed as it
// is placed, from its ring and the place of its move in the game, so two marbles placed on one
// ring at different times differ; a jumper carries its own to where it lands. A marble no action
// placed (on a scenario's starting board) takes its ring's.

// The seed of a marble placed on `coords` by the game's action number `index`, counting from 0:
// the marble you stage takes the seed of the move it will be.
export function placementSeed(coords: AxialCoordinates, index: number): number {
    return coordinatesToNumber(coords) + 7919 * (index + 1)
}

export type MarbleSeeds = ReadonlyMap<string, number>

export function marbleSeedsAfter(actions: readonly GameAction[]): MarbleSeeds {
    const seeds = new Map<string, number>()
    actions.forEach((action, index) => {
        if (isPlaceMarble(action)) {
            seeds.set(coordsKey(action.coords), placementSeed(action.coords, index))
        } else if (isCapture(action)) {
            const seed = seedAt(seeds, action.from)
            seeds.delete(coordsKey(action.from))
            if (action.metadata !== undefined) seeds.delete(coordsKey(action.metadata.over))
            seeds.set(coordsKey(action.to), seed)
        }
    })
    return seeds
}

export function seedAt(seeds: MarbleSeeds, coords: AxialCoordinates): number {
    return seeds.get(coordsKey(coords)) ?? coordinatesToNumber(coords)
}
