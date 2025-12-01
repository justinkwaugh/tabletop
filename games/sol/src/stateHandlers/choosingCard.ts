import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedChooseCard, isChooseCard } from '../actions/chooseCard.js'

// Transition from ChoosingCard(ChooseCard) -> StartOfTurn

export class ChoosingCardStateHandler implements MachineStateHandler<HydratedChooseCard> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedChooseCard {
        if (!action.playerId) return false
        return isChooseCard(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.ChooseCard]
    }

    enter(_context: MachineContext) {}

    onAction(_action: HydratedChooseCard, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        gameState.turnManager.endTurn(gameState.actionCount)
        return MachineState.StartOfTurn
    }
}
