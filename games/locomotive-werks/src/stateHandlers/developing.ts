import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import { HydratedPassDevelopment, isPassDevelopment } from '../actions/passDevelopment.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { endTurn, nextDeveloper } from './flow.js'
import { readLwSetup } from '../definition/setup.js'

type DevelopingAction = HydratedDevelop | HydratedPassDevelopment

export class DevelopingStateHandler implements MachineStateHandler<
    DevelopingAction,
    HydratedLwGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLwGameState>
    ): action is DevelopingAction {
        return isDevelop(action) || isPassDevelopment(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLwGameState>
    ): ActionType[] {
        return context.gameState.turnPlayerId() === playerId
            ? [ActionType.Develop, ActionType.PassDevelopment]
            : []
    }

    enter(context: MachineContext<HydratedLwGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(action: DevelopingAction, context: MachineContext<HydratedLwGameState>): MachineState {
        const state = context.gameState
        endTurn(state)
        return nextDeveloper(
            state,
            state.actionCount + 1,
            readLwSetup(context.gameConfig).buyAndShip,
            action.playerId
        )
    }
}
