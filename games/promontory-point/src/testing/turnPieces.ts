import { assert, assertExists } from '@tabletop/common'
import type { SpaceId } from '../components/board.js'
import type { RailroadId } from '../components/railroads.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { openSpaceIds } from '../rules/network.js'
import { withTrack } from './fixtures.js'
import { canonical } from './startGame.js'

// Swaps the turn pieces for the named ones, through the bottom of the bag, keeping piece conservation.
export function withTurnPieces(
    state: PromontoryPointGameState,
    pieces: RailroadId[]
): PromontoryPointGameState {
    const next = structuredClone(state)
    assertExists(next.turn, 'A turn is under way')
    next.bag.items.unshift(...next.turn.pieces)
    next.bag.remaining += next.turn.pieces.length
    next.turn.pieces = pieces.map((railroadId) => {
        const index = next.bag.items.lastIndexOf(railroadId)
        assert(index >= 0, `The bag holds no ${railroadId} piece`)
        next.bag.items.splice(index, 1)
        next.bag.remaining -= 1
        return railroadId
    })
    return canonical(next)
}

// R-3.3: blocks every space open to the railroad with the blocker's pieces.
export function withNoRoomFor(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    blocker: RailroadId
): PromontoryPointGameState {
    const placements: [SpaceId, RailroadId][] = openSpaceIds(state.track, railroadId).map(
        (spaceId) => [spaceId, blocker]
    )
    return withTrack(state, placements)
}

// R-2.2 step 3: turn pieces moved onto the board as placements made, keeping piece conservation.
export function withPlacementsMade(
    state: PromontoryPointGameState,
    placements: [SpaceId, RailroadId][]
): PromontoryPointGameState {
    const next = structuredClone(state)
    const turn = next.turn
    assertExists(turn, 'A turn is under way')
    for (const [spaceId, railroadId] of placements) {
        const index = turn.pieces.indexOf(railroadId)
        assert(index >= 0, `No ${railroadId} turn piece to place`)
        assert(!(spaceId in next.track), `${spaceId} already holds a piece`)
        turn.pieces.splice(index, 1)
        next.track[spaceId] = railroadId
        turn.placementsMade += 1
        turn.placementsLeft -= 1
    }
    return canonical(next)
}

// R-2.2-H1, R-3.3-H1: the turn's placing over and trading open again, the pieces left scrapped.
export function withPlacingEnded(state: PromontoryPointGameState): PromontoryPointGameState {
    const next = structuredClone(state)
    const turn = next.turn
    assertExists(turn, 'A turn is under way')
    for (const railroadId of turn.pieces) {
        next.scrapped[railroadId] += 1
    }
    turn.pieces = []
    turn.placementsLeft = 0
    next.machineState = MachineState.TradingAfterPlacing
    return canonical(next)
}
