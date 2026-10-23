import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    remove
} from '@tabletop/common'
import { HydratedSubmitPlan, isSubmitPlan } from '../actions/submitPlan.js'
import { RevealPlans } from '../actions/revealPlans.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import type { PlanningState } from '../model/plans.js'

// Every farmer with a decision seals a plan; the last one to commit opens them all.
export class PlanningStateHandler implements MachineStateHandler<
    HydratedSubmitPlan,
    HydratedDickeKartoffelnGameState
> {
    constructor(private readonly round: PlanningState) {}

    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedDickeKartoffelnGameState>
    ): action is HydratedSubmitPlan {
        return isSubmitPlan(action) && context.gameState.activePlayerIds.includes(action.playerId)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedDickeKartoffelnGameState>
    ): ActionType[] {
        return context.gameState.activePlayerIds.includes(playerId) ? [ActionType.SubmitPlan] : []
    }

    enter(_context: MachineContext<HydratedDickeKartoffelnGameState>) {}

    onAction(
        action: HydratedSubmitPlan,
        context: MachineContext<HydratedDickeKartoffelnGameState>
    ): MachineState {
        const state = context.gameState
        remove(state.activePlayerIds, action.playerId)
        if (state.activePlayerIds.length > 0) {
            return this.round
        }
        context.addSystemAction(RevealPlans, { step: this.round, revealsInfo: true })
        return MachineState.RevealingPlans
    }
}
