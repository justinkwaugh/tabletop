import { assert, assertExists, type AxialCoordinates } from '@tabletop/common'
import { BOARD_GRID, BoardNodeKind, type SpaceId } from '../components/board.js'
import { perRailroad, type RailroadId } from '../components/railroads.js'
import type { TownTileKindId } from '../components/townTiles.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { networkSpaceIds, openSpaceIds } from '../rules/network.js'
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

// Lays the railroad's track out to the nearest towns, one per kind, and gives each its tile.
export function withTownsOpenTo(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    kinds: TownTileKindId[]
): { state: PromontoryPointGameState; spaceIds: SpaceId[] } {
    let next = state
    const spaceIds: SpaceId[] = []
    for (const kindId of kinds) {
        const path = pathToNearestTown(next, railroadId, spaceIds)
        const town = path[path.length - 1]
        next = withTownTile(
            withTrack(
                next,
                path.slice(0, -1).map((spaceId) => [spaceId, railroadId])
            ),
            town,
            kindId
        )
        spaceIds.push(town)
    }
    return { state: next, spaceIds }
}

// R-3.3: every space open to the railroad taken by the blocker's track, laid out from the
// blocker's own network over open country, so each blocking piece is connected.
export function withBoxedIn(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    blocker: RailroadId
): PromontoryPointGameState {
    let next = state
    for (const target of openSpaceIds(state.track, railroadId)) {
        if (!(target in next.track)) {
            next = withTrack(
                next,
                pathOverOpenCountry(next, blocker, target).map((spaceId) => [spaceId, blocker])
            )
        }
    }
    assert(openSpaceIds(next.track, railroadId).length === 0, `${railroadId} is boxed in`)
    return next
}

// R-1.2: the railroad's marker moved to the price index.
export function withPriceIndex(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    priceIndex: number
): PromontoryPointGameState {
    return edited(state, (draft) => {
        draft.priceIndex[railroadId] = priceIndex
    })
}

// R-6.1-H2: leaves `count` pieces in the bag; the rest are scrapped, so conservation holds.
export function withBagLeft(
    state: PromontoryPointGameState,
    count: number
): PromontoryPointGameState {
    const next = structuredClone(state)
    for (const railroadId of next.bag.items.splice(count)) {
        next.scrapped[railroadId] += 1
    }
    next.bag.remaining = next.bag.items.length
    return canonical(next)
}

// Breadth first from the home hex over empty spaces, to a town not yet chosen.
function pathToNearestTown(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    chosen: readonly SpaceId[]
): SpaceId[] {
    const home = BOARD_GRID.homeHex(railroadId).coords
    const queue: { coords: AxialCoordinates; path: SpaceId[] }[] = [{ coords: home, path: [] }]
    const seen = new Set<SpaceId>()
    while (queue.length > 0) {
        const step = queue.shift()
        assertExists(step, 'The queue is not empty')
        for (const space of BOARD_GRID.spacesAdjacentTo(step.coords)) {
            const owner = space.spaceId in state.track ? state.track[space.spaceId] : undefined
            if (seen.has(space.spaceId) || (owner !== undefined && owner !== railroadId)) {
                continue
            }
            seen.add(space.spaceId)
            const path = owner === railroadId ? step.path : [...step.path, space.spaceId]
            if (
                owner === undefined &&
                space.kind === BoardNodeKind.Town &&
                !chosen.includes(space.spaceId)
            ) {
                return path
            }
            if (owner === railroadId || space.kind === BoardNodeKind.Empty) {
                queue.push({ coords: space.coords, path })
            }
        }
    }
    throw new Error(`No town reachable by ${railroadId}`)
}

// The shortest run of empty open country from the railroad's network to the target, the target last.
function pathOverOpenCountry(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    target: SpaceId
): SpaceId[] {
    const starts = [
        BOARD_GRID.homeHex(railroadId).coords,
        ...networkSpaceIds(state.track, railroadId).map(
            (spaceId) => BOARD_GRID.requireSpace(spaceId).coords
        )
    ]
    const queue: { coords: AxialCoordinates; path: SpaceId[] }[] = starts.map((coords) => ({
        coords,
        path: []
    }))
    const seen = new Set<SpaceId>()
    while (queue.length > 0) {
        const step = queue.shift()
        assertExists(step, 'The queue is not empty')
        for (const space of BOARD_GRID.spacesAdjacentTo(step.coords)) {
            if (seen.has(space.spaceId) || space.spaceId in state.track) {
                continue
            }
            seen.add(space.spaceId)
            const path = [...step.path, space.spaceId]
            if (space.spaceId === target) {
                return path
            }
            if (space.kind === BoardNodeKind.Empty) {
                queue.push({ coords: space.coords, path })
            }
        }
    }
    throw new Error(`${target} is not reachable by ${railroadId} over open country`)
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
