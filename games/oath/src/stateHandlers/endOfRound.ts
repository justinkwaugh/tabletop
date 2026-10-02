import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRollEndDie, isRollEndDie } from '../actions/rollEndDie.js'
import { isPlayerActionOfType } from './handlerSupport.js'

/** R-3.3 — the round has ended with the Empire holding the title; the Chancellor rolls. */
export class EndOfRoundStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.RollEndDie)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return HydratedRollEndDie.canDoRollEndDie(context.gameState, playerId)
            ? [ActionType.RollEndDie]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        context.gameState.activePlayerIds = [context.gameState.chancellorId()]
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isRollEndDie(action)) {
            // R-1.7 — a round that goes on starts with the Chancellor's Wake.
            return context.gameState.winningPlayerIds.length > 0
                ? MachineState.EndOfGame
                : MachineState.WakePhase
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
