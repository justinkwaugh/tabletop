import type { GameAction } from '@tabletop/common'
import {
    isCounterAttack,
    isDeclareAttack,
    DefenseAwaits,
    isDeclareFeint,
    type Attack
} from '@tabletop/napoleons-triumph'
import type { ArrowDrawing } from '$lib/utils/attackMarker.js'

export enum AttackMarkKind {
    /** Threatened and not yet pressed: nobody's colour. */
    Threat = 'threat',
    Attack = 'attack',
    Feint = 'feint'
}

export interface AttackMark {
    approach: number
    kind: AttackMarkKind
    attackerId: string
    /** Set once units have counter-attacked: the defender, whose narrower arrow runs back the other way. */
    counterAttackerId?: string
}

type MarkedAttack = Pick<
    Attack,
    | 'attackApproach'
    | 'attackerId'
    | 'defenderId'
    | 'feint'
    | 'initialResult'
    | 'counterAttackingUnitIds'
    | 'defendingUnitIds'
    | 'retreatBeforeCombat'
    | 'guardAttack'
    | 'awaits'
> & {
    /** Held by an attack whose defence named its leaders with its pieces, until the attacker pressed on; only its presence is read. */
    defensePlan?: unknown
}

// Rule 11, step 3: once the defence has stood and the attack no longer waits on the choice to feint,
// the attacker has pressed on. A Guard Attack cannot be called off, so it is an attack from the moment it is announced.
function pressed(attack: MarkedAttack): boolean {
    return (
        attack.guardAttack === true ||
        (attack.defendingUnitIds.length > 0 &&
            attack.defensePlan === undefined &&
            attack.awaits !== DefenseAwaits.Feint &&
            attack.retreatBeforeCombat !== true)
    )
}

/**
 * How far an attack has gone, for the arrow on its approach. A history picture passes the action it
 * shows, because the attack as recorded beside that action may not hold what the action did.
 */
export function attackMarkOf(attack: MarkedAttack, action?: GameAction): AttackMark {
    const feint = attack.feint === true || isDeclareFeint(action)
    const declared =
        attack.initialResult !== undefined || isDeclareAttack(action) || pressed(attack)
    const countered =
        attack.counterAttackingUnitIds.length > 0 ||
        (isCounterAttack(action) && action.unitIds.length > 0)
    return {
        approach: attack.attackApproach,
        kind: feint
            ? AttackMarkKind.Feint
            : declared
              ? AttackMarkKind.Attack
              : AttackMarkKind.Threat,
        attackerId: attack.attackerId,
        counterAttackerId: countered ? attack.defenderId : undefined
    }
}

export function arrowDrawingOf(mark: AttackMark): ArrowDrawing {
    return {
        feint: mark.kind === AttackMarkKind.Feint,
        countered: mark.counterAttackerId !== undefined
    }
}
