import {
    assert,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { RevealHand, isRevealHand, type HydratedRevealHand } from '../actions/revealHand.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'

// R-2.1, R-2.2 step 1: the next seat in turn order opens its turn by revealing its hand.
export class StartingTurnStateHandler implements MachineStateHandler<
    HydratedRevealHand,
    HydratedPromontoryPointGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): action is HydratedRevealHand {
        return isRevealHand(action)
    }

    // R-X.1: the reveal is the rules' own step, so no seat is offered a choice here.
    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): ActionType[] {
        return []
    }

    // R-2.1: seat order from the turn manager; the attributed reveal needs its seat active.
    enter(context: MachineContext<HydratedPromontoryPointGameState>) {
        const state = context.gameState
        assert(state.turn === undefined, 'The last turn ended before the next starts')
        assert(state.pendingRepairs === undefined, 'No Repairs outlives its turn')
        const playerId = state.turnManager.startNextTurn(state.actionCount)
        state.activePlayerIds = [playerId]
        context.addSystemAction(RevealHand, { playerId })
    }

    onAction(
        _action: HydratedRevealHand,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): MachineState {
        return MachineState.TradingBeforePlacing
    }
}
