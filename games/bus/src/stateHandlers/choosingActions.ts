import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedChooseWorkerAction, isChooseWorkerAction } from '../actions/chooseWorkerAction.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { getNextActionState } from '../utils/nextActionState.js'

type ChoosingActionsAction = HydratedChooseWorkerAction | HydratedPass

export class ChoosingActionsStateHandler implements MachineStateHandler<
    ChoosingActionsAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is ChoosingActionsAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isChooseWorkerAction(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedChooseWorkerAction.canChooseWorkerAction(gameState, playerId)) {
            validActions.push(ActionType.ChooseWorkerAction)
        }

        if (HydratedPass.canPass(gameState, playerId)) {
            validActions.push(ActionType.Pass)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const gameState = context.gameState
        let activePlayerId: string
        if (gameState.players.every((p) => p.numActionsChosen === 0)) {
            gameState.roundStartMaxBusValue = gameState.maxBusValue()
            for (const passenger of gameState.board.passengers) {
                passenger.siteId = undefined
            }
            activePlayerId = gameState.turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            activePlayerId = gameState.turnManager.startNextTurn(
                gameState.actionCount,
                (playerId: string) => {
                    return !gameState.passedPlayers.includes(playerId)
                }
            )
        }
        gameState.activePlayerIds = [activePlayerId]
    }

    onAction(
        action: ChoosingActionsAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        const gameState = context.gameState
        switch (true) {
            case isChooseWorkerAction(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.ChoosingActions
            }
            case isPass(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                if (gameState.players.every((p) => gameState.passedPlayers.includes(p.playerId))) {
                    return getNextActionState(gameState)
                }
                return MachineState.ChoosingActions
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
