import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSetTurnOrder, isSetTurnOrder } from '../actions/setTurnOrder.js'
import { HydratedPlaceTurnOrderBid, isPlaceTurnOrderBid } from '../actions/placeTurnOrderBid.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'

type BiddingForTurnOrderAction = HydratedPass | HydratedPlaceTurnOrderBid | HydratedSetTurnOrder

export class BiddingForTurnOrderStateHandler implements MachineStateHandler<
    BiddingForTurnOrderAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): action is BiddingForTurnOrderAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isPass(action) || isPlaceTurnOrderBid(action) || isSetTurnOrder(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        if (HydratedPass.canPass(gameState, playerId)) {
            validActions.push(ActionType.Pass)
        }

        if (HydratedPlaceTurnOrderBid.canPlaceTurnOrderBid(gameState, playerId)) {
            validActions.push(ActionType.PlaceTurnOrderBid)
        }

        if (HydratedSetTurnOrder.canSetTurnOrder(gameState, playerId)) {
            validActions.push(ActionType.SetTurnOrder)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager

        let nextPlayerId
        if (phaseManager.currentPhase?.name !== PhaseName.BidForTurnOrder) {
            phaseManager.startPhase(PhaseName.BidForTurnOrder, gameState.actionCount)
            gameState.turnOrderBids = {}
            nextPlayerId = turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            nextPlayerId = turnManager.startNextTurn(gameState.actionCount)
        }

        assertExists(
            nextPlayerId,
            'There should always be a next player when entering the BiddingForTurnOrder state'
        )
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(
        action: BiddingForTurnOrderAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        switch (true) {
            case isPass(action): {
                return MachineState.BiddingForTurnOrder
            }
            case isPlaceTurnOrderBid(action): {
                const state = context.gameState
                state.turnManager.endTurn(state.actionCount)

                return MachineState.BiddingForTurnOrder
            }
            case isSetTurnOrder(action): {
                return MachineState.BiddingForTurnOrder
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
