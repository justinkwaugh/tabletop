import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { planProblem } from '../model/planRules.js'
import { Plan, isPlanningState, planKindFor } from '../model/plans.js'

export type SubmitPlan = Type.Static<typeof SubmitPlan>
export const SubmitPlan = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SubmitPlan),
            playerId: Type.String(),
            plan: Visibility.protect(Plan, { policy: Visibility.Policy.Actor })
        })
    ])
)

export const SubmitPlanValidator = Compile(SubmitPlan)

export function isSubmitPlan(action?: GameAction): action is SubmitPlan {
    return action?.type === ActionType.SubmitPlan
}

export class HydratedSubmitPlan extends HydratableAction<typeof SubmitPlan> implements SubmitPlan {
    declare type: ActionType.SubmitPlan
    declare playerId: string
    declare plan: Plan

    constructor(data: SubmitPlan) {
        super(data, SubmitPlanValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        assert(isPlanningState(state.machineState), 'Nothing is being planned now')
        assert(
            this.plan.kind === planKindFor(state.machineState),
            `A ${this.plan.kind} plan does not belong to ${state.machineState}`
        )
        const player = state.getPlayerState(this.playerId)
        assert(player.plan === undefined, 'This plan is already sealed')
        const problem = planProblem(player, this.plan)
        assert(problem === undefined, problem ?? '')
        player.plan = structuredClone(this.plan)
    }
}
