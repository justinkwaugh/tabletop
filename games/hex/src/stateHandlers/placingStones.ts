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
import { HydratedHexGameState } from '../model/gameState.js'
import { turnHolder } from './turnFlow.js'

type PlacingAction = HydratedPlaceStone | HydratedSwapColors

export class PlacingStonesStateHandler implements MachineStateHandler<
    PlacingAction,
    HydratedHexGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedHexGameState>
    ): action is PlacingAction {
        return isPlaceStone(action) || (isSwapColors(action) && this.swapAllowed(context))
    }

    validActionsForPlayer(
        _playerId: string,
        context: MachineContext<HydratedHexGameState>
    ): ActionType[] {
        return this.swapAllowed(context)
            ? [ActionType.PlaceStone, ActionType.SwapColors]
            : [ActionType.PlaceStone]
    }

    enter(context: MachineContext<HydratedHexGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(action: PlacingAction, context: MachineContext<HydratedHexGameState>): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        if (isPlaceStone(action)) {
            assertExists(action.metadata, 'A placed stone records whether it joins its edges')
            if (action.metadata.joinsEdges) {
                gameState.winningPlayerIds = [action.playerId]
                return MachineState.EndOfGame
            }
        }
        gameState.turnManager.startNextTurn(gameState.actionCount)
        return MachineState.PlacingStones
    }

    private swapAllowed(context: MachineContext<HydratedHexGameState>): boolean {
        return swapRuleFromConfig(context.gameConfig) && context.gameState.swapIsOpen()
    }
}
