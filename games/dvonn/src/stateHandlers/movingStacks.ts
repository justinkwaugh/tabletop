import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMoveStack, isMoveStack } from '../actions/moveStack.js'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { firstMovingTurn, nextTurnAfterMove, type NextTurn } from './turnFlow.js'

function startTurn(state: HydratedDvonnGameState, next: NextTurn): MachineState {
    if (next.playerId === undefined) {
        state.declareResult()
        return MachineState.EndOfGame
    }
    state.turnManager.startTurn(next.playerId, state.actionCount)
    return MachineState.MovingStacks
}

export function beginMovingStacks(state: HydratedDvonnGameState): MachineState {
    return startTurn(state, firstMovingTurn(state))
}

export class MovingStacksStateHandler implements MachineStateHandler<
    HydratedMoveStack,
    HydratedDvonnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedDvonnGameState>
    ): action is HydratedMoveStack {
        return isMoveStack(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDvonnGameState>
    ): ActionType[] {
        return [ActionType.MoveStack]
    }

    enter(context: MachineContext<HydratedDvonnGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
    }

    onAction(
        action: HydratedMoveStack,
        context: MachineContext<HydratedDvonnGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        return startTurn(gameState, nextTurnAfterMove(gameState, action.playerId))
    }
}
