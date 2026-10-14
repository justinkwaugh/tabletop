import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, DefenseAwaits } from '@tabletop/napoleons-triumph'
import { AttackMarkKind, attackMarkOf } from './attackMark.js'

const THREAT = {
    attackApproach: 12,
    attackerId: 'french',
    defenderId: 'allied',
    counterAttackingUnitIds: [],
    defendingUnitIds: []
}
const STOOD = { ...THREAT, defendingUnitIds: ['d1'], awaits: DefenseAwaits.Feint }
const PRESSED = { ...THREAT, defendingUnitIds: ['d1'], awaits: DefenseAwaits.Leaders }
const LED = { ...THREAT, defendingUnitIds: ['d1'] }

function action(type: ActionType, fields: Record<string, unknown> = {}): GameAction {
    return { id: 'a', gameId: 'g', type, source: ActionSource.User, ...fields }
}

describe('the mark of an attack on its approach', () => {
    it('is nobody’s while the attack is only threatened', () => {
        expect(attackMarkOf(THREAT)).toEqual({
            approach: 12,
            kind: AttackMarkKind.Threat,
            attackerId: 'french',
            counterAttackerId: undefined
        })
    })

    it('stays nobody’s while the defence stands and the attacker has yet to press on, and after a retreat before combat', () => {
        expect(attackMarkOf(STOOD).kind).toBe(AttackMarkKind.Threat)
        expect(attackMarkOf({ ...THREAT, retreatBeforeCombat: true }).kind).toBe(
            AttackMarkKind.Threat
        )
    })

    it('is the attacker’s from the moment the attack is pressed, before the defence names its leading units and after', () => {
        expect(attackMarkOf(PRESSED).kind).toBe(AttackMarkKind.Attack)
        expect(attackMarkOf(LED).kind).toBe(AttackMarkKind.Attack)
    })

    it('reads an attack whose defence named its leaders with its pieces the same way', () => {
        const heldBack = { ...LED, defensePlan: { playerId: 'allied' } }
        expect(attackMarkOf(heldBack).kind).toBe(AttackMarkKind.Threat)
    })

    it('is the attacker’s from the announcement of a Guard Attack, which cannot be called off', () => {
        expect(attackMarkOf({ ...THREAT, guardAttack: true }).kind).toBe(AttackMarkKind.Attack)
        expect(attackMarkOf({ ...STOOD, guardAttack: true }).kind).toBe(AttackMarkKind.Attack)
    })

    it('is the attacker’s once the attack is declared, whatever its result', () => {
        expect(attackMarkOf({ ...THREAT, initialResult: 0 }).kind).toBe(AttackMarkKind.Attack)
        expect(attackMarkOf({ ...THREAT, initialResult: -2 }).kind).toBe(AttackMarkKind.Attack)
    })

    it('is a feint once the attack is called off', () => {
        expect(attackMarkOf({ ...THREAT, feint: true }).kind).toBe(AttackMarkKind.Feint)
    })

    it('names the defender for the arrow back once units have counter-attacked', () => {
        const countered = { ...THREAT, initialResult: 1, counterAttackingUnitIds: ['u1'] }
        expect(attackMarkOf(countered).counterAttackerId).toBe('allied')
        expect(attackMarkOf({ ...THREAT, initialResult: 1 }).counterAttackerId).toBeUndefined()
    })

    it('goes by the action a history picture shows where the attack beside it does not yet say', () => {
        expect(attackMarkOf(THREAT, action(ActionType.DeclareAttack)).kind).toBe(
            AttackMarkKind.Attack
        )
        expect(attackMarkOf(THREAT, action(ActionType.DeclareFeint)).kind).toBe(
            AttackMarkKind.Feint
        )
        const declared = { ...THREAT, initialResult: 1 }
        expect(
            attackMarkOf(declared, action(ActionType.CounterAttack, { unitIds: ['u1'] }))
                .counterAttackerId
        ).toBe('allied')
        expect(
            attackMarkOf(declared, action(ActionType.CounterAttack, { unitIds: [] }))
                .counterAttackerId
        ).toBeUndefined()
    })
})
