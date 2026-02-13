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
        const activePlayerId = context.gameState.startingPlayerAction
        assert(activePlayerId, 'No active player for starting player action')

        context.gameState.turnManager.startTurn(activePlayerId, context.gameState.actionCount)
        context.gameState.activePlayerIds = [activePlayerId]

        context.addSystemAction(SetFirstPlayer, {
            playerId: activePlayerId
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
                return MachineState.ChoosingActions
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
