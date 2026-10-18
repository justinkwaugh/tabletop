import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedStartTurn, StartTurn, isStartTurn } from '../actions/startTurn.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isCampaign } from '../model/campaign.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { firstPhase } from '../model/turnPlan.js'
import { stateForPhase } from './transitions.js'

export class StartOfTurnStateHandler implements MachineStateHandler<
    HydratedStartTurn,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedStartTurn {
        return isStartTurn(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(StartTurn)
    }

    onAction(
        _action: HydratedStartTurn,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        return isCampaign(state)
            ? MachineState.EconomicPhase
            : stateForPhase(state, firstPhase(state))
    }
}
