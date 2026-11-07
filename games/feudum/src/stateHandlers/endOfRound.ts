import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { isEndRound, type HydratedEndRound } from '../actions/endRound.js'
import { StartRound } from '../actions/startRound.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-2.2.5 Step 5 of the round. The engine's alone. */
export class EndOfRoundStateHandler implements MachineStateHandler<
    HydratedEndRound,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedEndRound {
        return isEndRound(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        context.gameState.activePlayerIds = []
    }

    /** R-2.2 The next round begins. */
    onAction(
        _action: HydratedEndRound,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        context.addSystemAction(StartRound)
        return MachineState.SelectingHands
    }
}
