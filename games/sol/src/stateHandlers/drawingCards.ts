import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedDrawCards, isDrawCards } from '../actions/drawCards.js'

// Transition from DrawingCards(DrawCards) -> SolarFlare | ChoosingCard

export class DrawingCardsStateHandler implements MachineStateHandler<HydratedDrawCards> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedDrawCards {
        if (!action.playerId) return false
        return isDrawCards(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.DrawCards]
    }

    enter(_context: MachineContext) {}

    onAction(_action: HydratedDrawCards, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        // Check for solar flares and handle them first
        return MachineState.ChoosingCards
    }
}
