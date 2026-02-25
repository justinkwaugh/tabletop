import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedDeliverGood, isDeliverGood } from '../actions/deliverGood.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'

type OperationsAction = HydratedDeliverGood

function hasCompletedOperationsTurn(state: HydratedIndonesiaGameState, playerId: string): boolean {
    const currentPhase = state.phaseManager.currentPhase
    if (!currentPhase || currentPhase.name !== PhaseName.Operations) {
        return false
    }
    return state.turnManager.hadTurnSinceAction(playerId, currentPhase.start)
}

export class OperationsStateHandler implements MachineStateHandler<OperationsAction, HydratedIndonesiaGameState> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is OperationsAction {
        return isDeliverGood(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (
            !hasCompletedOperationsTurn(gameState, playerId) &&
            HydratedDeliverGood.canDeliverGood(gameState, playerId)
        ) {
            validActions.push(ActionType.DeliverGood)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager

        let nextPlayerId: string | undefined
        if (phaseManager.currentPhase?.name !== PhaseName.Operations) {
            phaseManager.startPhase(PhaseName.Operations, gameState.actionCount)
            nextPlayerId = turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            const currentPhase = phaseManager.currentPhase
            assertExists(currentPhase, 'Current phase should exist in Operations enter')

            const playersStillToAct = turnManager.turnOrder.filter(
                (playerId) => !turnManager.hadTurnSinceAction(playerId, currentPhase.start)
            )
            if (playersStillToAct.length === 0) {
                gameState.activePlayerIds = []
                return
            }

            nextPlayerId = turnManager.nextPlayer(turnManager.lastPlayer(), (playerId) =>
                playersStillToAct.includes(playerId)
            )
            turnManager.startTurn(nextPlayerId, gameState.actionCount)
        }

        assertExists(nextPlayerId, 'There should always be a next player when entering Operations')
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(
        action: OperationsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState

        switch (true) {
            case isDeliverGood(action): {
                state.turnManager.endTurn(state.actionCount)

                const currentPhase = state.phaseManager.currentPhase
                assertExists(currentPhase, 'Current phase should exist while handling DeliverGood')
                const allPlayersDelivered = state.turnManager.turnOrder.every((playerId) =>
                    state.turnManager.hadTurnSinceAction(playerId, currentPhase.start)
                )

                if (allPlayersDelivered) {
                    state.phaseManager.endPhase(state.actionCount)
                    return MachineState.BiddingForTurnOrder
                }

                return MachineState.Operations
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
