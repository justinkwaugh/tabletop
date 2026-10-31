import type { GameAction } from '@tabletop/common'
import {
    isEndTurn,
    isPlaceTrack,
    type HydratedPromontoryPointGameState,
    type PlaceTrack,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'

export type TurnPlacement = {
    spaceId: SpaceId
    railroadId: RailroadId
    order: number
}

export type RepairsTown = {
    spaceId: SpaceId
    railroadId: RailroadId
}

// R-2.2 step 3: the open turn's placements in the order made, read from the actions behind the state.
export function thisTurnPlacements(
    state: HydratedPromontoryPointGameState,
    actions: readonly GameAction[]
): TurnPlacement[] {
    if (state.turn === undefined) {
        return []
    }
    return thisTurnPlaceTracks(actions).map((action, index) => ({
        spaceId: action.spaceId,
        railroadId: action.railroadId,
        order: index + 1
    }))
}

// R-4.3, R-4.3-H4: while debtors decide, the Repairs town is the turn's latest placement.
export function repairsTownBeingDecided(
    state: HydratedPromontoryPointGameState,
    actions: readonly GameAction[]
): RepairsTown | undefined {
    const placement = repairsPlacementBeingDecided(state, actions)
    return placement === undefined || state.pendingRepairs === undefined
        ? undefined
        : { spaceId: placement.spaceId, railroadId: state.pendingRepairs.railroadId }
}

// R-4.3: the placement that billed the Repairs still being paid.
export function repairsPlacementBeingDecided(
    state: HydratedPromontoryPointGameState,
    actions: readonly GameAction[]
): PlaceTrack | undefined {
    return state.pendingRepairs === undefined ? undefined : thisTurnPlaceTracks(actions).at(-1)
}

function thisTurnPlaceTracks(actions: readonly GameAction[]): PlaceTrack[] {
    const lastEndTurn = actions.findLastIndex((action) => isEndTurn(action))
    return actions.slice(lastEndTurn + 1).filter(isPlaceTrack)
}
