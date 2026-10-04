import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { HydratedConfirmTurn, isConfirmTurn } from '../actions/confirmTurn.js'
import { HydratedCompleteAntiqueSet, isCompleteAntiqueSet } from '../actions/completeAntiqueSet.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { queueTurnCommit } from '../util/automaticActions.js'
import { activateTurnPlayer, finishTurn } from '../util/turns.js'

type ConfirmingTurnAction = HydratedConfirmTurn | HydratedCompleteAntiqueSet | HydratedEndTurn

export class ConfirmingTurnStateHandler implements MachineStateHandler<
    ConfirmingTurnAction,
    HydratedMarracashGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMarracashGameState>
    ): action is ConfirmingTurnAction {
        const gameState = context.gameState
        if (isConfirmTurn(action)) {
            return gameState.activePlayerIds.includes(action.playerId)
        }
        if (isCompleteAntiqueSet(action)) {
            return (
                action.source === ActionSource.System &&
                gameState.isNextAntiqueSet(action.collectorId)
            )
        }
        return isEndTurn(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMarracashGameState>
    ): ActionType[] {
        return context.gameState.activePlayerIds.includes(playerId) ? [ActionType.ConfirmTurn] : []
    }

    enter(context: MachineContext<HydratedMarracashGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(
        action: ConfirmingTurnAction,
        context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        switch (true) {
            case isConfirmTurn(action): {
                queueTurnCommit(context)
                return MachineState.ConfirmingTurn
            }
            case isCompleteAntiqueSet(action): {
                return MachineState.ConfirmingTurn
            }
            case isEndTurn(action): {
                return finishTurn(context.gameState)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
