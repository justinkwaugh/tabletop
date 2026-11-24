import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedChooseColor, isChooseColor } from '../actions/chooseColor.js'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { startMovingTurn } from './movingStacks.js'
import { firstMovingTurn, turnHolder } from './turnFlow.js'

// I set, you choose: once the first player has set the board, the other takes a colour.
export class ChoosingColorStateHandler implements MachineStateHandler<
    HydratedChooseColor,
    HydratedDvonnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedDvonnGameState>
    ): action is HydratedChooseColor {
        return isChooseColor(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDvonnGameState>
    ): ActionType[] {
        return [ActionType.ChooseColor]
    }

    enter(context: MachineContext<HydratedDvonnGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: HydratedChooseColor,
        context: MachineContext<HydratedDvonnGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        const next = firstMovingTurn(gameState)
        assertExists(action.metadata, 'A choice of colour records its outcome')
        if (next.passedPlayerId !== undefined) {
            action.metadata.passedPlayerId = next.passedPlayerId
        }
        return startMovingTurn(gameState, next)
    }
}
