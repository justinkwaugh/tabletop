import { assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { DecisionKind } from '../model/attack.js'
import {
    canPressAttack,
    currentAttack,
    eligibleReserveDefenders,
    mustDefend,
    nextDecision
} from '../model/attackFlow.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { StepStateHandler, type AllowedAction } from './stepStateHandler.js'

function attacker(state: HydratedNapoleonsTriumphGameState): string {
    return currentAttack(state).attackerId
}

function defender(state: HydratedNapoleonsTriumphGameState): string {
    return currentAttack(state).defenderId
}

export class DefenseResponseStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [
        {
            type: ActionType.DeclareDefense,
            allowed: (state) => mustDefend(state) || eligibleReserveDefenders(state).length > 0
        },
        { type: ActionType.Retreat, allowed: (state) => !mustDefend(state) }
    ]

    protected actor = defender
}

export class FeintDecisionStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [
        { type: ActionType.DeclareFeint },
        { type: ActionType.PressAttack, allowed: canPressAttack }
    ]

    protected actor = attacker
}

export class AttackDeclarationStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [{ type: ActionType.DeclareAttack }]

    protected actor = attacker
}

export class CounterAttackDecisionStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [{ type: ActionType.CounterAttack }]

    protected actor = defender
}

const DECISION_ACTIONS: Record<DecisionKind, ActionType> = {
    [DecisionKind.OddLoss]: ActionType.AssignLosses,
    [DecisionKind.ExcessLosses]: ActionType.AssignLosses,
    [DecisionKind.Regroup]: ActionType.Regroup,
    [DecisionKind.Advance]: ActionType.Advance
}

export class ResolvingAttackStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = Object.values(DecisionKind).map((kind) => ({
        type: DECISION_ACTIONS[kind],
        allowed: (state: HydratedNapoleonsTriumphGameState) => nextDecision(state)?.kind === kind
    }))

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        const decision = nextDecision(state)
        assertExists(decision, 'No decision is waiting')
        return decision.playerId
    }
}

export class RetreatingStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [{ type: ActionType.Retreat }]

    protected actor = defender
}

export class OccupyingStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [{ type: ActionType.Occupy }]

    protected actor = attacker
}
