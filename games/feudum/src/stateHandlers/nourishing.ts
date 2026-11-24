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

    /** R-4.10-H4 */
    enter(context: MachineContext<HydratedFeudumGameState>) {
        const { flow, turnManager } = context.gameState
        context.gameState.activePlayerIds = turnManager.turnOrder.filter((playerId) =>
            flow.nourish?.pending.includes(playerId)
        )
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
