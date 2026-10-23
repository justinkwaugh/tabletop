import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMoveRing, isMoveRing } from '../actions/moveRing.js'
import { HydratedYinshGameState } from '../model/gameState.js'
import { startResolving } from './turnFlow.js'

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
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
    }

    onAction(
        action: HydratedMoveRing,
        context: MachineContext<HydratedYinshGameState>
    ): MachineState {
        return startResolving(context.gameState, action.playerId)
    }
}
