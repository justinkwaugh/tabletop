import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import {
    HydratedSettleSyndicateTakes,
    SettleSyndicateTakes,
    isSettleSyndicateTakes
} from '../actions/settleSyndicateTakes.js'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterSyndicateTakes } from './transitions.js'

export class SettlingSyndicateTakesStateHandler implements MachineStateHandler<
    HydratedSettleSyndicateTakes,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedSettleSyndicateTakes {
        return isSettleSyndicateTakes(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(SettleSyndicateTakes)
    }

    onAction(
        _action: HydratedSettleSyndicateTakes,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterSyndicateTakes(context.gameState)
    }
}
