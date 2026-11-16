import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMoveRing, isMoveRing } from '../actions/moveRing.js'
import { HydratedYinshGameState } from '../model/gameState.js'
import { startResolving, turnHolder } from './turnFlow.js'

export class MovingRingStateHandler implements MachineStateHandler<
    HydratedMoveRing,
    HydratedYinshGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedYinshGameState>
    ): action is HydratedMoveRing {
        return isMoveRing(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedYinshGameState>
    ): ActionType[] {
        return [ActionType.MoveRing]
    }

    enter(context: MachineContext<HydratedYinshGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: HydratedMoveRing,
        context: MachineContext<HydratedYinshGameState>
    ): MachineState {
        const { next, passedPlayerId } = startResolving(context.gameState, action.playerId)
        assertExists(action.metadata, 'A moved ring records the markers it flipped')
        if (passedPlayerId !== undefined) action.metadata.passedPlayerId = passedPlayerId
        return next
    }
}
