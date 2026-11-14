import { coordinatesToNumber, type AxialCoordinates, type GameAction } from '@tabletop/common'
import { isCapture, isPlaceMarble } from '@tabletop/zertz'

// Seeded by ring and action number, so two marbles placed on one ring at different times differ.

export function placementSeed(coords: AxialCoordinates, index: number): number {
    return coordinatesToNumber(coords) + 7919 * (index + 1)
}

export type MarbleSeeds = ReadonlyMap<number, number>

export function marbleSeedsAfter(actions: readonly GameAction[]): MarbleSeeds {
    const seeds = new Map<number, number>()
    actions.forEach((action, index) => applyToSeeds(seeds, action, index))
    return seeds
}

export function applyToSeeds(seeds: Map<number, number>, action: GameAction, index: number) {
    if (isPlaceMarble(action)) {
        seeds.set(coordinatesToNumber(action.coords), placementSeed(action.coords, index))
    } else if (isCapture(action)) {
        const seed = seedAt(seeds, action.from)
        seeds.delete(coordinatesToNumber(action.from))
        if (action.metadata !== undefined) seeds.delete(coordinatesToNumber(action.metadata.over))
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
