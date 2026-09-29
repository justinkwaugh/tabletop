import { describe, expect, it } from 'vitest'
import {
    ATTACK_DIE_FACES,
    DEFENSE_DIE_FACES,
    attackFromFaces,
    defenseShieldsFromFaces,
    END_DIE_FACES,
    rollAttackDice,
    rollDefenseDice,
    rollEndDie
} from './dice.js'
import { testPlayer, testState } from '../testing/fixture.js'

describe('the attack die faces (transcribed)', () => {
    it('has six faces', () => {
        expect(ATTACK_DIE_FACES).toHaveLength(6)
    })

    it('carries two plain sword faces', () => {
        const plain = ATTACK_DIE_FACES.filter(
            (f) => f.swords === 1 && f.hollowSwords === 0 && f.skulls === 0
        )
        expect(plain).toHaveLength(2)
    })

    it('carries three hollow sword faces', () => {
        const hollow = ATTACK_DIE_FACES.filter(
            (f) => f.hollowSwords === 1 && f.swords === 0 && f.skulls === 0
        )
        expect(hollow).toHaveLength(3)
    })

    it('carries one skull face, which also shows two swords', () => {
        const skulls = ATTACK_DIE_FACES.filter((f) => f.skulls > 0)
        expect(skulls).toHaveLength(1)
        expect(skulls[0]).toEqual({ swords: 2, hollowSwords: 0, skulls: 1 })
    })
})

describe('the defense die faces (transcribed)', () => {
    it('has six faces', () => {
        expect(DEFENSE_DIE_FACES).toHaveLength(6)
    })

    it('carries two blanks, two single shields and one double shield', () => {
        const shieldCounts = DEFENSE_DIE_FACES.filter((f) => !f.doubling).map((f) => f.shields)
        expect(shieldCounts.sort()).toEqual([0, 0, 1, 1, 2])
    })

    // Its "x2" sits in a shield outline, read here as a frame for the glyph and not a shield.
    it('carries one doubling face, which is not itself a shield', () => {
        const doubling = DEFENSE_DIE_FACES.filter((f) => f.doubling)
        expect(doubling).toHaveLength(1)
        expect(doubling[0].shields).toBe(0)
    })
})

describe('attack arithmetic (R-5.5.5, R-5.5.5.a)', () => {
    const sword = { swords: 1, hollowSwords: 0, skulls: 0 }
    const hollow = { swords: 0, hollowSwords: 1, skulls: 0 }
    const skull = { swords: 2, hollowSwords: 0, skulls: 1 }

    it('adds solid swords one for one', () => {
        expect(attackFromFaces([sword, sword, sword])).toEqual({ swords: 3, skulls: 0 })
    })

    it('counts two hollow swords as one sword (R-5.5.5.a)', () => {
        expect(attackFromFaces([hollow, hollow])).toEqual({ swords: 1, skulls: 0 })
    })

    it('adds nothing for a single hollow sword (R-5.5.5.a)', () => {
        expect(attackFromFaces([hollow])).toEqual({ swords: 0, skulls: 0 })
    })

    it('drops the odd hollow sword rather than rounding it up', () => {
        expect(attackFromFaces([hollow, hollow, hollow])).toEqual({ swords: 1, skulls: 0 })
        expect(attackFromFaces([hollow, hollow, hollow, hollow, hollow])).toEqual({
            swords: 2,
            skulls: 0
        })
    })

    it('pools hollow swords across the whole roll, not per die', () => {
        expect(attackFromFaces([hollow, sword, hollow, sword, hollow])).toEqual({
            swords: 3,
            skulls: 0
        })
    })

    it('counts a skull face for both its skull and its two swords', () => {
        expect(attackFromFaces([skull])).toEqual({ swords: 2, skulls: 1 })
        expect(attackFromFaces([skull, skull])).toEqual({ swords: 4, skulls: 2 })
    })

    it('is zero for an empty pool', () => {
        expect(attackFromFaces([])).toEqual({ swords: 0, skulls: 0 })
    })
})

describe('defense shield arithmetic (R-5.5.4, R-5.5.4.a)', () => {
    const blank = { shields: 0, doubling: false }
    const shield = { shields: 1, doubling: false }
    const twoShields = { shields: 2, doubling: false }
    const x2 = { shields: 0, doubling: true }

    it('adds shields one for one', () => {
        expect(defenseShieldsFromFaces([shield, twoShields, blank])).toBe(3)
    })

    it('doubles the total shields rolled (R-5.5.4.a)', () => {
        expect(defenseShieldsFromFaces([shield, twoShields, x2])).toBe(6)
    })

    it('stacks doublings exponentially, not additively (R-5.5.4.a)', () => {
        expect(defenseShieldsFromFaces([shield, x2, x2])).toBe(4)
        expect(defenseShieldsFromFaces([shield, x2, x2, x2])).toBe(8)
    })

    it('doubles nothing when nothing was rolled', () => {
        expect(defenseShieldsFromFaces([x2, x2, x2])).toBe(0)
    })

    it('is zero for an empty pool', () => {
        expect(defenseShieldsFromFaces([])).toBe(0)
    })
})

describe('rolling from state.prng', () => {
    function state(seed: number) {
        return testState([testPlayer()], { prng: { seed, invocations: 0 } })
    }

    it('is deterministic for a given seed', () => {
        const a = rollAttackDice(state(12345).getProtectedPrng(), 5)
        const b = rollAttackDice(state(12345).getProtectedPrng(), 5)
        expect(a).toEqual(b)
    })

    it('rolls the number of dice asked for', () => {
        expect(rollAttackDice(state(1).getProtectedPrng(), 7)).toHaveLength(7)
        expect(rollDefenseDice(state(1).getProtectedPrng(), 4)).toHaveLength(4)
    })

    it('rolls nothing for an empty pool without touching the prng', () => {
        const s = state(1)
        expect(rollAttackDice(s.getProtectedPrng(), 0)).toEqual([])
        expect(s.prng.invocations).toBe(0)
    })

    it('advances the prng once per die, so the roll is recorded in state', () => {
        const s = state(99)
        rollAttackDice(s.getProtectedPrng(), 3)
        expect(s.prng.invocations).toBe(3)

        rollDefenseDice(s.getProtectedPrng(), 2)
        expect(s.prng.invocations).toBe(5)
    })

    it('only ever returns real faces of the die', () => {
        const faces = rollAttackDice(state(777).getProtectedPrng(), 200)
        for (const face of faces) {
            expect(ATTACK_DIE_FACES).toContainEqual(face)
        }
    })

    it('reaches every face of each die over enough rolls', () => {
        const attack = rollAttackDice(state(4242).getProtectedPrng(), 500)
        for (const face of ATTACK_DIE_FACES) {
            expect(attack).toContainEqual(face)
        }
        const defense = rollDefenseDice(state(4242).getProtectedPrng(), 500)
        for (const face of DEFENSE_DIE_FACES) {
            expect(defense).toContainEqual(face)
        }
    })
})

describe('the end die (R-3.3)', () => {
    function endState(seed: number) {
        return testState([testPlayer()], { prng: { seed, invocations: 0 } })
    }

    it('has six faces numbered 1 to 6, as R-3.3\u2019s own thresholds require', () => {
        expect(END_DIE_FACES).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('rolls from state.prng, one invocation per roll (R-X.3)', () => {
        const s = endState(7)
        const rolled = rollEndDie(s.getProtectedPrng())
        expect(END_DIE_FACES).toContain(rolled)
        expect(s.prng.invocations).toBe(1)
    })

    it('is deterministic for a given seed, so a replay ends the same game', () => {
        expect(rollEndDie(endState(4242).getProtectedPrng())).toBe(rollEndDie(endState(4242).getProtectedPrng()))
    })

    it('reaches every face', () => {
        const s = endState(11)
        const seen = new Set<number>()
        for (let i = 0; i < 400; i += 1) seen.add(rollEndDie(s.getProtectedPrng()))
        expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6])
    })
})
