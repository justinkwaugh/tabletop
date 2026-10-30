import { assert, assertExists, type AxialCoordinates, type GameConfig } from '@tabletop/common'
import {
    BOARD_GRID,
    BoardNodeKind,
    PromontoryPointGameStateValidator,
    openSpaceIds,
    perRailroad,
    type PromontoryPointGameState,
    type RailroadId,
    type SpaceId,
    type TownTileKindId
} from '@tabletop/promontory-point'

export type Holding = { money: number; shares?: Partial<Record<RailroadId, number>> }

// Every fixture stays a legal canonical state: piece and share conservation hold.
export function canonical(state: unknown): PromontoryPointGameState {
    assert(PromontoryPointGameStateValidator.Check(state), 'Expected a legal canonical state')
    return state
}

export function seatOf(state: PromontoryPointGameState, position: number): string {
    const playerId = state.turnManager.turnOrder[position]
    assertExists(playerId, `No seat at position ${position}`)
    return playerId
}

export function variantConfig(fourPieceVariant: boolean): GameConfig {
    return { fourPieceVariant }
}

// Swaps the turn pieces for the named ones through the bag.
export function withTurnPieces(
    state: PromontoryPointGameState,
    pieces: RailroadId[]
): PromontoryPointGameState {
    const next = structuredClone(state)
    assertExists(next.turn, 'A turn is under way')
    next.bag.items.unshift(...next.turn.pieces)
    next.bag.remaining += next.turn.pieces.length
    next.turn.pieces = pieces.map((railroadId) => takeFromBag(next, railroadId))
    return canonical(next)
}

// Moves a railroad's piece from the bag onto each space.
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

// R-3.3: every space open to the railroad taken by the blocker's pieces.
export function withNoRoomFor(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    blocker: RailroadId
): PromontoryPointGameState {
    return withTrack(
        state,
        openSpaceIds(state.track, railroadId).map((spaceId) => [spaceId, blocker])
    )
}

// Money and shares by seat in turn order; a share not named is not held.
export function withHoldings(
    state: PromontoryPointGameState,
    holdings: Holding[]
): PromontoryPointGameState {
    const next = structuredClone(state)
    for (const [position, { money, shares = {} }] of holdings.entries()) {
        const playerId = seatOf(next, position)
        const player = next.players.find((seat) => seat.playerId === playerId)
        assertExists(player, `No player ${playerId}`)
        player.money = money
        player.shares = perRailroad((railroadId) => shares[railroadId] ?? 0)
    }
    return canonical(next)
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

// Swaps town tiles so the space carries the kind, keeping the tile counts.
function withTownTile(
    state: PromontoryPointGameState,
    spaceId: SpaceId,
    kindId: TownTileKindId
): PromontoryPointGameState {
    const next = structuredClone(state)
    const current = next.towns[spaceId]
    assertExists(current, `${spaceId} is not a town`)
    const other = BOARD_GRID.spaces().find(
        (space) => space.spaceId in next.towns && next.towns[space.spaceId] === kindId
    )
    assertExists(other, `No town holds ${kindId}`)
    next.towns[other.spaceId] = current
    next.towns[spaceId] = kindId
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

function takeFromBag(state: PromontoryPointGameState, railroadId: RailroadId): RailroadId {
    const index = state.bag.items.lastIndexOf(railroadId)
    assert(index >= 0, `The bag holds no ${railroadId} piece`)
    state.bag.items.splice(index, 1)
    state.bag.remaining -= 1
    return railroadId
}
