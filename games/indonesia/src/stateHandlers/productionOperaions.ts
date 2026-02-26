import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedDeliverGood, isDeliverGood } from '../actions/deliverGood.js'
import { HydratedExpand, isExpand } from '../actions/expand.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'

type ProductionOperaionsAction = HydratedDeliverGood | HydratedExpand

function finishOperatingCompany(state: HydratedIndonesiaGameState): MachineState {
    state.operatingCompanyId = undefined
    state.turnManager.endTurn(state.actionCount)

    const currentPhase = state.phaseManager.currentPhase
    assertExists(currentPhase, 'Current phase should exist while handling production operations')
    const playersWhoCanOperate = state.turnManager.turnOrder.filter((playerId) =>
        state.companies.some((company) => company.owner === playerId)
    )
    const allPlayersOperated =
        playersWhoCanOperate.length === 0 ||
        playersWhoCanOperate.every((playerId) =>
            state.turnManager.hadTurnSinceAction(playerId, currentPhase.start)
        )
    if (allPlayersOperated) {
        state.phaseManager.endPhase(state.actionCount)
        return MachineState.BiddingForTurnOrder
    }

    return MachineState.Operations
}

export class ProductionOperaionsStateHandler
    implements MachineStateHandler<ProductionOperaionsAction, HydratedIndonesiaGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is ProductionOperaionsAction {
        return isDeliverGood(action) || isExpand(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (HydratedDeliverGood.canDeliverGood(gameState, playerId)) {
            validActions.push(ActionType.DeliverGood)
        }
        if (HydratedExpand.canExpand(gameState, playerId)) {
            validActions.push(ActionType.Expand)
        }

        return validActions
    }

    enter(_context: MachineContext<HydratedIndonesiaGameState>) {}

    onAction(
        action: ProductionOperaionsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isDeliverGood(action):
            case isExpand(action): {
                return finishOperatingCompany(state)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
