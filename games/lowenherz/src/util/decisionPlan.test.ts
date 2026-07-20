import { describe, expect, it } from 'vitest'
import { buildDecisionPlan, currentDecisionPlayer, isRoundDecided, rotateToStart } from './decisionPlan.js'

describe('buildDecisionPlan', () => {
    it('gives each of 4 players exactly 1 slot, in turn order', () => {
        expect(buildDecisionPlan(['p1', 'p2', 'p3', 'p4'])).toEqual(['p1', 'p2', 'p3', 'p4'])
    })

    it('gives the first player 2 slots (front-loaded) and the others 1 each, for 3 players', () => {
        expect(buildDecisionPlan(['p1', 'p2', 'p3'])).toEqual(['p1', 'p1', 'p2', 'p3'])
    })

    it('gives both players 2 slots each (front-loaded), for 2 players', () => {
        expect(buildDecisionPlan(['p1', 'p2'])).toEqual(['p1', 'p1', 'p2', 'p2'])
    })
})

describe('rotateToStart', () => {
    it('rotates the seating order to begin at the given player', () => {
        expect(rotateToStart(['p1', 'p2', 'p3', 'p4'], 'p3')).toEqual(['p3', 'p4', 'p1', 'p2'])
    })

    it('is a no-op when already starting at that player', () => {
        expect(rotateToStart(['p1', 'p2', 'p3'], 'p1')).toEqual(['p1', 'p2', 'p3'])
    })
})

describe('currentDecisionPlayer / isRoundDecided', () => {
    it('walks through the plan and completes at the end', () => {
        const plan = buildDecisionPlan(['p1', 'p2', 'p3'])

        expect(currentDecisionPlayer(plan, 0)).toBe('p1')
        expect(currentDecisionPlayer(plan, 1)).toBe('p1')
        expect(currentDecisionPlayer(plan, 2)).toBe('p2')
        expect(currentDecisionPlayer(plan, 3)).toBe('p3')
        expect(currentDecisionPlayer(plan, 4)).toBeUndefined()

        expect(isRoundDecided(plan, 3)).toBe(false)
        expect(isRoundDecided(plan, 4)).toBe(true)
    })
})
