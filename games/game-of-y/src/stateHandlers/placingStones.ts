import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { swapRuleFromConfig } from '../definition/config.js'
import { HydratedPlaceStone, isPlaceStone } from '../actions/placeStone.js'
import { HydratedSwapColors, isSwapColors } from '../actions/swapColors.js'
import { HydratedYGameState } from '../model/gameState.js'
import { turnHolder } from './turnFlow.js'

type PlacingAction = HydratedPlaceStone | HydratedSwapColors

export class PlacingStonesStateHandler implements MachineStateHandler<
    PlacingAction,
    HydratedYGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedYGameState>
    ): action is PlacingAction {
        return isPlaceStone(action) || (isSwapColors(action) && this.swapAllowed(context))
    }

    validActionsForPlayer(
        _playerId: string,
        context: MachineContext<HydratedYGameState>
    ): ActionType[] {
        return this.swapAllowed(context)
            ? [ActionType.PlaceStone, ActionType.SwapColors]
            : [ActionType.PlaceStone]
    }

    enter(context: MachineContext<HydratedYGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(action: PlacingAction, context: MachineContext<HydratedYGameState>): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        if (isPlaceStone(action)) {
            assertExists(action.metadata, 'A placed stone records whether it forms a Y')
            if (action.metadata.formsY) {
                gameState.winningPlayerIds = [action.playerId]
                return MachineState.EndOfGame
            }
        }
        gameState.turnManager.startNextTurn(gameState.actionCount)
        return MachineState.PlacingStones
    }

    private swapAllowed(context: MachineContext<HydratedYGameState>): boolean {
        return swapRuleFromConfig(context.gameConfig) && context.gameState.swapIsOpen()
    }
}
