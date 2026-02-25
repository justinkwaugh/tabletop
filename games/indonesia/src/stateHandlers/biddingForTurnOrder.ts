import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSetTurnOrder, isSetTurnOrder, SetTurnOrder } from '../actions/setTurnOrder.js'
import { HydratedPlaceTurnOrderBid, isPlaceTurnOrderBid } from '../actions/placeTurnOrderBid.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'

type BiddingForTurnOrderAction = HydratedPlaceTurnOrderBid | HydratedSetTurnOrder

export class BiddingForTurnOrderStateHandler implements MachineStateHandler<
    BiddingForTurnOrderAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): action is BiddingForTurnOrderAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isPlaceTurnOrderBid(action) || isSetTurnOrder(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        if (HydratedPlaceTurnOrderBid.canPlaceTurnOrderBid(gameState, playerId)) {
            validActions.push(ActionType.PlaceTurnOrderBid)
        }

        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager

        const numPlayersWhoBid = gameState.turnOrderBids
            ? Object.keys(gameState.turnOrderBids).length
            : 0
        const allPlayersHaveBid = numPlayersWhoBid === gameState.players.length
        if (allPlayersHaveBid) {
            context.addSystemAction(SetTurnOrder)
            return
        }

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
        const state = context.gameState
        switch (true) {
            case isPlaceTurnOrderBid(action): {
                state.turnManager.endTurn(state.actionCount)
                return MachineState.BiddingForTurnOrder
            }
            case isSetTurnOrder(action): {
                state.turnOrderBids = undefined

                // TODO: determine if we need to do mergers
                return MachineState.Acquisitions
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
