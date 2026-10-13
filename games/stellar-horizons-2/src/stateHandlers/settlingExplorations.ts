import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import {
    HydratedSettleExplorations,
    SettleExplorations,
    isSettleExplorations
} from '../actions/settleExplorations.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { playersWithEarnedMarkers } from '../model/settlement.js'
import { stateAfterSettlement } from './transitions.js'

export class SettlingExplorationsStateHandler implements MachineStateHandler<
    HydratedSettleExplorations,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedSettleExplorations {
        return isSettleExplorations(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const [playerId] = playersWithEarnedMarkers(state)
        assertExists(playerId, 'Settling explorations requires markers to be drawn')
        state.activePlayerIds = [playerId]
        context.addSystemAction(SettleExplorations, { playerId })
    }

    onAction(
        _action: HydratedSettleExplorations,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        return playersWithEarnedMarkers(state).length > 0
            ? MachineState.SettlingExplorations
            : stateAfterSettlement(state)
    }
}
