import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { HydratedExpandCapacity, isExpandCapacity } from '../actions/expandCapacity.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { afterExpanding } from './flow.js'
import { readLwSetup } from '../definition/setup.js'

export class ExpandingCapacityStateHandler implements MachineStateHandler<
    HydratedExpandCapacity,
    HydratedLwGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLwGameState>
    ): action is HydratedExpandCapacity {
        return isExpandCapacity(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLwGameState>
    ): ActionType[] {
        return context.gameState.turnPlayerId() === playerId ? [ActionType.ExpandCapacity] : []
    }

    enter(context: MachineContext<HydratedLwGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    // The whole turn's plan comes in one action.
    onAction(
        action: HydratedExpandCapacity,
        context: MachineContext<HydratedLwGameState>
    ): MachineState {
        return afterExpanding(
            context.gameState,
            action.playerId,
            readLwSetup(context.gameConfig).buyAndShip
        )
    }
}
