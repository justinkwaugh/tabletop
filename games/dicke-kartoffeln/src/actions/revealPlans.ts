import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { executePlan } from '../model/planRules.js'
import { PlanOutcome, type PlanningState } from '../model/plans.js'

export type RevealPlansMetadata = Type.Static<typeof RevealPlansMetadata>
export const RevealPlansMetadata = Type.Object({
    outcomes: Type.Array(PlanOutcome)
})

export const PlanningStep = Type.Union([
    Type.Literal(MachineState.TakingCompost),
    Type.Literal(MachineState.Cultivating),
    Type.Literal(MachineState.Sowing),
    Type.Literal(MachineState.Fertilizing),
    Type.Literal(MachineState.Spraying),
    Type.Literal(MachineState.RegisteringSales),
    Type.Literal(MachineState.SpreadingCompost)
])

export type RevealPlans = Type.Static<typeof RevealPlans>
export const RevealPlans = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.RevealPlans),
            step: PlanningStep,
            metadata: Type.Optional(RevealPlansMetadata)
        })
    ])
)

export const RevealPlansValidator = Compile(RevealPlans)

export function isRevealPlans(action?: GameAction): action is RevealPlans {
    return action?.type === ActionType.RevealPlans
}

// Every farmer's sealed plan for the round is laid open and carried out together.
export class HydratedRevealPlans
    extends HydratableAction<typeof RevealPlans>
    implements RevealPlans
{
    declare type: ActionType.RevealPlans
    declare step: PlanningState
    declare metadata?: RevealPlansMetadata

    constructor(data: RevealPlans) {
        super(data, RevealPlansValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        const outcomes = state.players
            .filter((player) => player.plan !== undefined)
            .map((player) => {
                const plan = player.plan
                assertExists(plan, 'A sealed plan is expected')
                player.plan = undefined
                return executePlan(state, player, plan)
            })
        this.metadata = { outcomes }
    }
}
