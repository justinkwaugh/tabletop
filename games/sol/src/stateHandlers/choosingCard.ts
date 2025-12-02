import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedChooseCard, isChooseCard } from '../actions/chooseCard.js'
import { isPass } from '../actions/pass.js'

// Transition from ChoosingCard(ChooseCard) -> StartOfTurn
// Transition from ChoosingCard(Pass) -> StartOfTurn

export class ChoosingCardStateHandler implements MachineStateHandler<HydratedChooseCard> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedChooseCard {
        if (!action.playerId) return false
        return isChooseCard(action) || isPass(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.Pass, ActionType.ChooseCard]
    }

    enter(_context: MachineContext) {}

    onAction(_action: HydratedChooseCard, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        gameState.turnManager.endTurn(gameState.actionCount)
        return MachineState.StartOfTurn
    }
}
