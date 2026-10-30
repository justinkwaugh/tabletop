import { assert, assertExists } from '@tabletop/common'
import { BOARD_GRID, type BoardNodeKind, type SpaceId } from '../components/board.js'
import { perRailroad, type RailroadId } from '../components/railroads.js'
import type { TownTileKindId } from '../components/townTiles.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { canonical } from './startGame.js'
import { edited, playerOf } from './turns.js'

export type Holding = { money: number; shares?: Partial<Record<RailroadId, number>> }

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

// Swaps town tiles so the space carries the kind, keeping the tile counts.
export function withTownTile(
    state: PromontoryPointGameState,
    spaceId: SpaceId,
    kindId: TownTileKindId
): PromontoryPointGameState {
    return edited(state, (draft) => {
        const current = draft.towns[spaceId]
        if (current === kindId) {
            return
        }
        const other = BOARD_GRID.spaces().find(
            (space) => space.spaceId in draft.towns && draft.towns[space.spaceId] === kindId
        )
        assertExists(other, `No town holds ${kindId}`)
        draft.towns[other.spaceId] = current
        draft.towns[spaceId] = kindId
    })
}

// Money and shares by seat in turn order; a share not named is not held.
export function withHoldings(
    state: PromontoryPointGameState,
    holdings: Holding[]
): PromontoryPointGameState {
    return edited(state, (draft) => {
        for (const [index, { money, shares = {} }] of holdings.entries()) {
            const playerId = draft.turnManager.turnOrder[index]
            assertExists(playerId, `No seat ${index}`)
            const player = playerOf(draft, playerId)
            player.money = money
            player.shares = perRailroad((railroadId) => shares[railroadId] ?? 0)
        }
    })
}

// The nearest space of a kind to a railroad's home, with track placed up to it.
export function reaching(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    kind: BoardNodeKind
): { state: PromontoryPointGameState; spaceId: SpaceId } {
    const paths = BOARD_GRID.spaces()
        .filter((space) => space.kind === kind)
        .map((space) => pathFromHome(railroadId, space.spaceId))
        .sort((left, right) => left.length - right.length)
    const path = paths[0]
    assertExists(path, `No ${kind} space`)
    return {
        state: withTrack(
            state,
            path.slice(0, -1).map((spaceId) => [spaceId, railroadId])
        ),
        spaceId: path[path.length - 1]
    }
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
