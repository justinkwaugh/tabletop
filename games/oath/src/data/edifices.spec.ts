import { describe, expect, it } from 'vitest'
import { CardKind, Suit } from '../model/oathEnums.js'
import {
    BattlePlanSide,
    NO_COST,
    PowerTiming,
    cardDefinition,
    cardIdsOfKind,
    cardPowers,
    kindOf,
    suitOf
} from './cardRegistry.js'
import { EDIFICE_RECORDS, edificeName } from './edifices.js'

describe('the six edifice cards (R-2.9)', () => {
    it('registers six edifices, one per suit, and still 198 denizens', () => {
        const ids = cardIdsOfKind(CardKind.Edifice)
        expect(ids).toHaveLength(6)
        expect(new Set(ids.map((id) => suitOf(id)))).toEqual(new Set(Object.values(Suit)))
        expect(cardIdsOfKind(CardKind.Denizen)).toHaveLength(198)
    })

    it('an edifice id names its kind and its intact suit', () => {
        for (const id of cardIdsOfKind(CardKind.Edifice)) {
            expect(kindOf(id)).toBe(CardKind.Edifice)
            expect(id.split('.')[1]).toBe(suitOf(id))
        }
    })

    it('R-7.2.1, R-7.2.2 — every edifice is played to a site and locked there', () => {
        for (const id of cardIdsOfKind(CardKind.Edifice)) {
            const definition = cardDefinition(id)
            expect(definition?.placement).toBe('site')
            expect(definition?.locked).toBe(true)
        }
    })

    it('the twelve sides are numbered 199 to 210, each ruined side one after its intact side', () => {
        const numbers = EDIFICE_RECORDS.flatMap((rec) => {
            expect(rec.ruined.cardNumber).toBe(rec.intact.cardNumber + 1)
            return [rec.intact.cardNumber, rec.ruined.cardNumber]
        })
        expect([...numbers].sort((a, b) => a - b)).toEqual(
            Array.from({ length: 12 }, (_, i) => 199 + i)
        )
    })

    it('names the side that is up', () => {
        expect(edificeName('edifice.hearth.hall-of-debate', false)).toBe('Hall of Debate')
        expect(edificeName('edifice.hearth.hall-of-debate', true)).toBe('Hall of Mockery')
        expect(edificeName('edifice.nomad.ancient-forge', true)).toBe('Broken Forge')
        expect(cardDefinition('edifice.nomad.ancient-forge')?.name).toBe('Ancient Forge')
    })

    it('each side’s printed power is registered as one of the card’s two powers, intact first', () => {
        for (const rec of EDIFICE_RECORDS) {
            expect(cardPowers(rec.id).map((power) => power.text)).toEqual([
                rec.intact.powerText,
                rec.ruined.powerText
            ])
        }
        const forge = EDIFICE_RECORDS.find((rec) => rec.id === 'edifice.nomad.ancient-forge')
        expect(forge?.ruined.powerText).toBe('Action: Flip this card over.')
        expect(forge?.ruined.cost).toEqual({
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 2,
            burnSecret: 0
        })
    })

    it('Bandit Rampart is a defender battle plan, as its blue power box and crowned icon print it (R-7.5)', () => {
        const [, bandit] = cardPowers('edifice.order.sprawling-rampart')
        expect(bandit).toMatchObject({
            text: '-2 [attackDie] if this site is targeted.',
            timing: PowerTiming.BattlePlan,
            battlePlanSide: BattlePlanSide.Defender
        })
        expect(bandit.cost).toEqual(NO_COST)
    })
})
