import { describe, expect, it } from 'vitest'
import { cardDefinitions } from '../data/cardRegistry.js'
import { cardPowers } from '../data/cardPowers.js'
import { PowerChoiceKind } from '../model/powerChoice.js'
import { choiceSpecsFor } from './registry.js'
import '../powers/index.js'

const TERROR = 'denizen.arcane.terror-spells'
const BLOOD = 'denizen.arcane.blood-pact'

const SPECS = cardDefinitions().flatMap((card) =>
    cardPowers(card.id).flatMap((power) =>
        choiceSpecsFor(power).map((spec) => ({ cardId: power.cardId, spec }))
    )
)

describe('R-7.1.3 — the warband counts a power’s text sets, declared where it registers', () => {
    it('Terror Spells’ two picks name two warbands together; no other spec declares a total', () => {
        const together = SPECS.filter(({ spec }) => spec.together !== undefined)
        expect(together.map(({ cardId }) => cardId)).toEqual([TERROR, TERROR])
        for (const { spec } of together) {
            expect(spec.kind).toBe(PowerChoiceKind.Warbands)
            expect(spec.together).toBe(2)
        }
    })

    it('Blood Pact’s warbands go in pairs; no other spec declares a step', () => {
        const stepped = SPECS.filter(({ spec }) => spec.step !== undefined)
        expect(stepped.map(({ cardId }) => cardId)).toEqual([BLOOD])
        expect(stepped[0]?.spec.kind).toBe(PowerChoiceKind.Warbands)
        expect(stepped[0]?.spec.step).toBe(2)
    })
})
