import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
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
        console.log('entering state')
        if (gameState.players.every((p) => p.numActionsChosen === 0)) {
            gameState.roundStartMaxBusValue = gameState.maxBusValue()
            for (const passenger of gameState.board.passengers) {
                passenger.siteId = undefined
            }
            console.log('checking passed')
            gameState.passedPlayers = gameState.players
                .filter((p) => p.actions === 0)
                .map((p) => p.playerId)

            console.log('passed players:', gameState.passedPlayers)

            const nextPlayer = gameState.turnManager.turnOrder.find(
                (playerId) => !gameState.passedPlayers.includes(playerId)
            )
            assertExists(nextPlayer, 'No valid next player found')
            gameState.turnManager.startTurn(nextPlayer, gameState.actionCount)

            activePlayerId = nextPlayer
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
                const playerState = gameState.getPlayerState(action.playerId)
                if (playerState.actions === 0) {
                    gameState.passedPlayers.push(action.playerId)
                }

                return this.nextState(gameState)
            }
            case isPass(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                return this.nextState(gameState)
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    nextState(gameState: HydratedBusGameState): MachineState {
        if (gameState.players.every((p) => gameState.passedPlayers.includes(p.playerId))) {
            console.log('All players passed, moving to next round')
            gameState.passedPlayers = []
            for (const player of gameState.players) {
                player.numActionsChosen = 0
            }
            return getNextActionState(gameState)
        }
        return MachineState.ChoosingActions
    }
}
