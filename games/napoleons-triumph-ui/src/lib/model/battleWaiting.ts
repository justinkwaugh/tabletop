import {
    DecisionKind,
    MachineState,
    attackStep,
    lossOwnerOf,
    stepsOwed,
    type Attack,
    type AttackState,
    type AttackStep,
    type HydratedNapoleonsTriumphGameState,
    type OddLossDecision
} from '@tabletop/napoleons-triumph'
import { counted } from './attackLosses.js'
import { ARMIES } from './concludedBattle.js'

const WAITING: Record<AttackStep, string> = {
    [MachineState.DefenseResponse]: 'to defend or retreat',
    [MachineState.FeintDecision]: 'to press the attack or call it a feint',
    [MachineState.DefenseDeclaration]: 'to name the leading units of the defence',
    [MachineState.AttackDeclaration]: 'to declare the attack',
    [MachineState.CounterAttackDecision]: 'to counter-attack or hold',
    [MachineState.ResolvingAttack]: 'to settle the outcome',
    [MachineState.Retreating]: 'to retreat',
    [MachineState.Occupying]: 'to move in'
}

export function oddStepTakers(
    attack: Pick<Attack, 'counterAttackingUnitIds'>,
    decision: OddLossDecision
): string {
    return decision.unitIds.every((id) => attack.counterAttackingUnitIds.includes(id))
        ? 'counter-attacking'
        : 'leading'
}

export function awaitedStep(attack: AttackState, state: HydratedNapoleonsTriumphGameState): string {
    const decision = attack.pending[0]
    if (decision?.kind !== DecisionKind.OddLoss && decision?.kind !== DecisionKind.ExcessLosses) {
        return WAITING[attackStep(attack)]
    }
    const army = ARMIES[state.sideOf(lossOwnerOf(attack, decision))].adjective
    if (decision.kind === DecisionKind.OddLoss) {
        return `to choose which ${army} ${oddStepTakers(attack, decision)} unit takes the extra step`
    }
    return `to choose which ${army} units lose the ${counted(stepsOwed(decision), 'step')} still owed`
}
