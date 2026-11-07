import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { EndRound } from '../actions/endRound.js'
import { isRollProgressDie, type HydratedRollProgressDie } from '../actions/rollProgressDie.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-4.11 Step 3 of the round, and the check for step 4. The engine's alone. */
export class ProgressRollStateHandler implements MachineStateHandler<
    HydratedRollProgressDie,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedRollProgressDie {
        return isRollProgressDie(action)
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

    /** R-4.11.2 With an epoch triggered the round stays here for its dawn (R-4.12). */
    onAction(
        _action: HydratedRollProgressDie,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        if (context.gameState.flow.epochTriggered) {
            return MachineState.ProgressRoll
        }
        context.addSystemAction(EndRound)
        return MachineState.EndOfRound
    }
}
