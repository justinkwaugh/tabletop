import type { HydratedAction, MachineContext } from '@tabletop/common'
import {
    isCompleteStockRound,
    isFinishStockTurn,
    isPlaceStation,
    isStartOperatingRound,
    isStartOperatingSet,
    isStartOperatingTurn,
    isStartStockRound
} from '@tabletop/18xx'
import type { EighteenThirtyTwoStateHandler, HydratedEighteenThirtyTwoState } from './state.js'

/**
 * Clears the title's records of a turn, round or step once it is over: an operating turn's WVCF
 * purchase and Key West placement as the next turn or round starts, a stock turn's redemption
 * refusals as it finishes, a stock round's redemptions and locked proceeds as it completes, its
 * merger phase as the operating set begins, and a returned station once it is placed again.
 */
function clearSpentRecords(state: HydratedEighteenThirtyTwoState, action: HydratedAction): void {
    if (
        isStartOperatingTurn(action) ||
        isStartOperatingRound(action) ||
        isStartStockRound(action)
    ) {
        delete state.coalTokenBought
        delete state.keyWestPlaced
    }
    if (isFinishStockTurn(action)) delete state.redemptionRefusals
    if (isCompleteStockRound(action)) {
        delete state.redemptions
        delete state.lockedProceeds
    }
    if (isStartOperatingSet(action)) delete state.mergerPhaseHeld
    if (isPlaceStation(action) && state.returnedStationIds) {
        const returned = state.returnedStationIds.filter((stationId) =>
            state.stations.some(
                (station) => station.id === stationId && station.status === 'available'
            )
        )
        if (returned.length) state.returnedStationIds = returned
        else delete state.returnedStationIds
    }
}

/** A state's handler that clears spent title records after each of its actions. */
export function clearsSpentRecords(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction(action: HydratedAction, context: MachineContext<HydratedEighteenThirtyTwoState>) {
            clearSpentRecords(context.gameState, action)
            return handler.onAction(action, context)
        }
    }
}
