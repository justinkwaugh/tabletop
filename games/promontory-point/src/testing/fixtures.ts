import { assert } from '@tabletop/common'
import { BOARD_GRID, type SpaceId } from '../components/board.js'
import type { RailroadId } from '../components/railroads.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { canonical } from './startGame.js'

// Moves a railroad's piece from the bag onto each space, keeping piece conservation.
export function withTrack(
    state: PromontoryPointGameState,
    placements: [SpaceId, RailroadId][]
): PromontoryPointGameState {
    const next = structuredClone(state)
    for (const [spaceId, railroadId] of placements) {
        assert(!(spaceId in next.track), `${spaceId} already holds a piece`)
        next.track[spaceId] = takeFromBag(next, railroadId)
    }
    return canonical(next)
}

// Scraps every piece left in the bag, keeping piece conservation.
export function withEmptyBag(state: PromontoryPointGameState): PromontoryPointGameState {
    const next = structuredClone(state)
    for (const railroadId of next.bag.items) {
        next.scrapped[railroadId] += 1
    }
    next.bag.items = []
    next.bag.remaining = 0
    return canonical(next)
}

// The shortest run of spaces from a railroad's home hex to the target, the target last.
export function pathFromHome(railroadId: RailroadId, target: SpaceId): SpaceId[] {
    const home = BOARD_GRID.homeHex(railroadId)
    const previous = new Map<SpaceId, SpaceId | undefined>()
    const frontier: SpaceId[] = []
    for (const space of BOARD_GRID.spacesAdjacentTo(home.coords)) {
        previous.set(space.spaceId, undefined)
        frontier.push(space.spaceId)
    }
    for (let index = 0; index < frontier.length; index += 1) {
        const spaceId = frontier[index]
        if (spaceId === target) {
            return trace(previous, target)
        }
        for (const next of BOARD_GRID.spacesAdjacentTo(BOARD_GRID.requireSpace(spaceId).coords)) {
            if (!previous.has(next.spaceId)) {
                previous.set(next.spaceId, spaceId)
                frontier.push(next.spaceId)
            }
        }
    }
    throw new Error(`${target} is not reachable from ${railroadId}`)
}

function trace(previous: Map<SpaceId, SpaceId | undefined>, target: SpaceId): SpaceId[] {
    const path: SpaceId[] = []
    let step: SpaceId | undefined = target
    while (step !== undefined) {
        path.unshift(step)
        step = previous.get(step)
    }
    return path
}

function takeFromBag(state: PromontoryPointGameState, railroadId: RailroadId): RailroadId {
    const index = state.bag.items.indexOf(railroadId)
    assert(index >= 0, `The bag holds no ${railroadId} piece`)
    state.bag.items.splice(index, 1)
    state.bag.remaining -= 1
    return railroadId
}
