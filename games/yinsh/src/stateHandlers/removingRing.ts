import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRemoveRing, isRemoveRing } from '../actions/removeRing.js'
import { HydratedYinshGameState } from '../model/gameState.js'
import { continueResolving } from './turnFlow.js'

export class RemovingRingStateHandler implements MachineStateHandler<
    HydratedRemoveRing,
    HydratedYinshGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedYinshGameState>
    ): action is HydratedRemoveRing {
        return isRemoveRing(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedYinshGameState>
    ): ActionType[] {
        return [ActionType.RemoveRing]
    }

    enter(context: MachineContext<HydratedYinshGameState>) {
        const { gameState } = context
        gameState.activePlayerIds = gameState.resolvingPlayerIds.slice(0, 1)
    }

    // Rule H2: the first player to take off their last ring wins at once, the mover first.
    onAction(
        action: HydratedRemoveRing,
        context: MachineContext<HydratedYinshGameState>
    ): MachineState {
        const { gameState } = context
        if (gameState.hasWon(action.playerId)) {
            gameState.turnManager.endTurn(gameState.actionCount)
            gameState.declareWinner(action.playerId)
            return MachineState.EndOfGame
        }
        return continueResolving(gameState)
    }
}
