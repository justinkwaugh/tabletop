import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedChooseFirstPlayer, isChooseFirstPlayer } from '../actions/chooseFirstPlayer.js'
import { HydratedUrbinoGameState } from '../model/gameState.js'

type ChoosingFirstPlayerAction = HydratedChooseFirstPlayer

export class ChoosingFirstPlayerStateHandler
    implements MachineStateHandler<ChoosingFirstPlayerAction, HydratedUrbinoGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedUrbinoGameState>
    ): action is ChoosingFirstPlayerAction {
        return isChooseFirstPlayer(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedUrbinoGameState>
    ): ActionType[] {
        const { gameState } = context
        if (playerId !== gameState.turnManager.turnOrder[0]) return []
        return [ActionType.ChooseFirstPlayer]
    }

    enter(context: MachineContext<HydratedUrbinoGameState>) {
        const { gameState } = context
        gameState.activePlayerIds = [gameState.turnManager.turnOrder[0]]
    }

    onAction(
        action: ChoosingFirstPlayerAction,
        context: MachineContext<HydratedUrbinoGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.startTurn(action.startingPlayerId, gameState.actionCount)
        return MachineState.TakingTurn
    }
}
