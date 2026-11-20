import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { isNourish, type HydratedNourish } from '../actions/nourish.js'
import { isNourishPawns, type HydratedNourishPawns } from '../actions/nourishPawns.js'
import { RollProgressDie } from '../actions/rollProgressDie.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillWindow } from '../model/atWill.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'

export type NourishingAction = AtWillAction | HydratedNourish | HydratedNourishPawns

/** R-4.10, R-4.10-H4, R-3.1-H1, R-4.4-H1, R-4.11.1 */
export class NourishingStateHandler implements MachineStateHandler<
    NourishingAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is NourishingAction {
        return isNourishPawns(action) || isNourish(action) || isAtWillAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        return atWillWindow(state, playerId) === 'nourishing'
            ? [ActionType.Nourish, ...atWillOffers(state, playerId)]
            : []
    }

    /** R-4.10-H4 Every seat still deciding, in turn order. */
    enter(context: MachineContext<HydratedFeudumGameState>) {
        context.gameState.activePlayerIds = [...(context.gameState.flow.nourish?.pending ?? [])]
    }

    onAction(
        _action: NourishingAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        if (context.gameState.flow.nourish) {
            return MachineState.Nourishing
        }
        context.addSystemAction(RollProgressDie)
        return MachineState.ProgressRoll
    }
}
