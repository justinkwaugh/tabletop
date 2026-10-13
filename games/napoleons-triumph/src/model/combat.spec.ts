import { describe, expect, it } from 'vitest'
import { UnitType, type Face } from '../components/pieces.js'
import { ResultTermKind } from './attack.js'
import {
    counterAttackStrength,
    counterAttackTerm,
    initialResult,
    initialResultTerms,
    type Engagement
} from './combat.js'

const face = (type: UnitType, strength: number): Face => ({ type, strength })

function engagement(parts: Partial<Engagement>): Engagement {
    return {
        attackLeaders: [],
        defenseLeaders: [],
        defendersBlocking: false,
        approachPenalties: [],
        penaltiesApplyInReserve: false,
        guardAttack: false,
        ...parts
    }
}

const kindsOf = (parts: Partial<Engagement>) =>
    initialResultTerms(engagement(parts)).map((term) => [term.kind, term.value])

describe('what an initial result is made of (rule 11, step 6)', () => {
    it('is the attack’s leading units less the defence’s', () => {
        const attackLeaders = [face(UnitType.Infantry, 3), face(UnitType.Infantry, 2)]
        const defenseLeaders = [face(UnitType.Cavalry, 2)]
        expect(kindsOf({ attackLeaders, defenseLeaders })).toEqual([
            [ResultTermKind.AttackLeaders, 5],
            [ResultTermKind.DefenseLeaders, -2]
        ])
        const [led, stood] = initialResultTerms(engagement({ attackLeaders, defenseLeaders }))
        expect(led.faces).toEqual(attackLeaders)
        expect(stood.faces).toEqual(defenseLeaders)
    })

    it('takes one from infantry leading against a blocked approach, and one more where the approach penalises them', () => {
        expect(
            kindsOf({
                attackLeaders: [face(UnitType.Infantry, 3)],
                defenseLeaders: [face(UnitType.Infantry, 2)],
                defendersBlocking: true,
                approachPenalties: [UnitType.Infantry]
            })
        ).toEqual([
            [ResultTermKind.AttackLeaders, 3],
            [ResultTermKind.InfantryAgainstBlockers, -1],
            [ResultTermKind.ApproachPenalty, -1],
            [ResultTermKind.DefenseLeaders, -2]
        ])
    })

    it('leaves the approach’s penalty out against a defence from reserve, except on the Santon', () => {
        const parts = {
            attackLeaders: [face(UnitType.Cavalry, 2)],
            approachPenalties: [UnitType.Cavalry]
        }
        expect(kindsOf(parts)).toEqual([
            [ResultTermKind.AttackLeaders, 2],
            [ResultTermKind.DefenseLeaders, 0]
        ])
        expect(kindsOf({ ...parts, penaltiesApplyInReserve: true })).toEqual([
            [ResultTermKind.AttackLeaders, 2],
            [ResultTermKind.ApproachPenalty, -1],
            [ResultTermKind.DefenseLeaders, 0]
        ])
    })

    it('does not count the defence’s leading units against artillery', () => {
        expect(
            kindsOf({
                attackLeaders: [face(UnitType.Artillery, 1)],
                defenseLeaders: [face(UnitType.Infantry, 3)]
            })
        ).toEqual([
            [ResultTermKind.AttackLeaders, 1],
            [ResultTermKind.ArtilleryLeads, 0]
        ])
    })

    it('gives back one for each of the defence’s leading units under three strength in a Guard Attack', () => {
        expect(
            kindsOf({
                attackLeaders: [face(UnitType.Infantry, 3)],
                defenseLeaders: [face(UnitType.Infantry, 3), face(UnitType.Infantry, 2)],
                guardAttack: true
            })
        ).toEqual([
            [ResultTermKind.AttackLeaders, 3],
            [ResultTermKind.DefenseLeaders, -5],
            [ResultTermKind.GuardAttack, 1]
        ])
    })

    it('adds up to the initial result, and records the units as they were, not as they become', () => {
        const attackLeaders = [face(UnitType.Infantry, 3)]
        const parts = engagement({
            attackLeaders,
            defenseLeaders: [face(UnitType.Infantry, 2)],
            defendersBlocking: true,
            guardAttack: true
        })
        const terms = initialResultTerms(parts)
        expect(terms.reduce((sum, term) => sum + term.value, 0)).toBe(initialResult(parts))
        expect(initialResult(parts)).toBe(1)
        attackLeaders[0].strength = 1
        expect(terms[0].faces).toEqual([face(UnitType.Infantry, 3)])
    })
})

describe('what a counter-attack takes from the result (rule 11, step 8)', () => {
    it('is each unit’s strength less the step it loses first', () => {
        const units = [face(UnitType.Cavalry, 3), face(UnitType.Cavalry, 1)]
        expect(counterAttackTerm(units)).toEqual({
            kind: ResultTermKind.CounterAttack,
            value: -2,
            faces: units
        })
        expect(counterAttackTerm(units).value).toBe(0 - counterAttackStrength(units))
        expect(counterAttackTerm([]).value).toBe(0)
    })
})
