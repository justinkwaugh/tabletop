import {
    DecisionKind,
    MachineState,
    Side,
    attackStep,
    type AttackState,
    type AttackStep
} from '@tabletop/napoleons-triumph'
import { counted, ownerOfLoss, stepsOwedBy } from './attackLosses.js'

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

const ARMIES: Record<Side, string> = {
    [Side.French]: 'French',
    [Side.Allied]: 'Allied'
}

/** What the player an attack waits on is to do, as the other player is told it. */
export function awaitedStep(attack: AttackState, sideOf: (playerId: string) => Side): string {
    const decision = attack.pending[0]
    if (decision?.kind === DecisionKind.OddLoss) {
        return `to choose which ${ARMIES[sideOf(ownerOfLoss(attack, decision))]} leading unit takes the extra step`
    }
    if (decision?.kind === DecisionKind.ExcessLosses) {
        return `to choose which ${ARMIES[sideOf(ownerOfLoss(attack, decision))]} units lose the ${counted(stepsOwedBy(decision), 'step')} still owed`
    }
    return WAITING[attackStep(attack)]
}
