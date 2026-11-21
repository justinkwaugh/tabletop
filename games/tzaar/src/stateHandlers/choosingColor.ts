import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedChooseColor, isChooseColor } from '../actions/chooseColor.js'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { activateCurrentPlayer, beginPlay } from './turnFlow.js'

// I set, you choose: once the first player has set the board, the other takes a colour.
export class ChoosingColorStateHandler implements MachineStateHandler<
    HydratedChooseColor,
    HydratedTzaarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedTzaarGameState>
    ): action is HydratedChooseColor {
        return isChooseColor(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedTzaarGameState>
    ): ActionType[] {
        return [ActionType.ChooseColor]
    }

    enter(context: MachineContext<HydratedTzaarGameState>) {
        activateCurrentPlayer(context.gameState)
    }

    onAction(
        action: HydratedChooseColor,
        context: MachineContext<HydratedTzaarGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        assertExists(action.metadata, 'A choice of colour records its outcome')
        return beginPlay(gameState, action.metadata.stuckPlayerId)
    }
}
