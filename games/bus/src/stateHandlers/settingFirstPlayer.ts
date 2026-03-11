import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedSetFirstPlayer,
    isSetFirstPlayer,
    SetFirstPlayer
} from '../actions/setFirstPlayer.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { getNextActionState } from '../utils/nextActionState.js'

type SettingFirstPlayerAction = HydratedSetFirstPlayer

export class SettingFirstPlayerStateHandler implements MachineStateHandler<
    SettingFirstPlayerAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is SettingFirstPlayerAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isSetFirstPlayer(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        return [ActionType.SetFirstPlayer]
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const gameState = context.gameState
        const currentFirstPlayerId = gameState.turnManager.turnOrder[0]
        assert(currentFirstPlayerId, 'No current first player')
        const nextPlayerId =
            gameState.startingPlayerAction ??
            gameState.turnManager.nextPlayer(currentFirstPlayerId, (playerId) => {
                return gameState.getPlayerState(playerId).actions > 0
            })

        // This is wrong in the case of passing turn order to next player, but it will break existing games if we don't do it
        gameState.turnManager.startTurn(nextPlayerId, gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]

        context.addSystemAction(SetFirstPlayer, {
            playerId: nextPlayerId
        })
    }

    onAction(
        action: SettingFirstPlayerAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        switch (true) {
            case isSetFirstPlayer(action): {
                context.gameState.startingPlayerAction = undefined
                context.gameState.turnManager.endTurn(context.gameState.actionCount)
                return getNextActionState(context.gameState)
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
