import { describe, expect, it } from 'vitest'
import { buildPlacementPlan, currentPlacementSlot, isSetupComplete } from './placementPlan.js'
import { NEUTRAL_OWNER } from '../model/owner.js'

describe('buildPlacementPlan', () => {
    it('builds 12 total placements for a 4-player game with no neutral prince', () => {
        const turnOrder = ['p1', 'p2', 'p3', 'p4']
        const plan = buildPlacementPlan(turnOrder, false)

        expect(plan.length).toBe(12)
        expect(plan.every((slot) => slot.owner === slot.playerId)).toBe(true)
        // Round-robin: p1,p2,p3,p4 repeated 3 times
        expect(plan.map((s) => s.playerId)).toEqual([
            'p1', 'p2', 'p3', 'p4',
            'p1', 'p2', 'p3', 'p4',
            'p1', 'p2', 'p3', 'p4'
        ])
    })

    it('builds 12 total placements for a 3-player game: 9 own + 3 neutral', () => {
        const plan = buildPlacementPlan(['p1', 'p2', 'p3'], true)

        expect(plan.length).toBe(12)
        expect(plan.slice(0, 9).every((slot) => slot.owner === slot.playerId)).toBe(true)
        expect(plan.slice(9, 12).every((slot) => slot.owner === NEUTRAL_OWNER)).toBe(true)
        expect(plan.slice(9, 12).map((s) => s.playerId)).toEqual(['p1', 'p2', 'p3'])
    })

    it('builds 12 total placements for a 2-player game: 8 own + 4 neutral', () => {
        const plan = buildPlacementPlan(['p1', 'p2'], true)

        expect(plan.length).toBe(12)
        expect(plan.slice(0, 8).every((slot) => slot.owner === slot.playerId)).toBe(true)
        expect(plan.slice(8, 12).every((slot) => slot.owner === NEUTRAL_OWNER)).toBe(true)
    })

    it('throws if the neutral prince is missing for a 2 or 3 player game', () => {
        expect(() => buildPlacementPlan(['p1', 'p2', 'p3'], false)).toThrow()
        expect(() => buildPlacementPlan(['p1', 'p2'], false)).toThrow()
    })
})

describe('currentPlacementSlot / isSetupComplete', () => {
    it('walks through the plan in order and completes at the end', () => {
        const plan = buildPlacementPlan(['p1', 'p2', 'p3', 'p4'], false)

        expect(isSetupComplete(plan, 0)).toBe(false)
        expect(currentPlacementSlot(plan, 0)?.playerId).toBe('p1')
        expect(currentPlacementSlot(plan, 11)?.playerId).toBe('p4')
        expect(isSetupComplete(plan, 11)).toBe(false)
        expect(isSetupComplete(plan, 12)).toBe(true)
        expect(currentPlacementSlot(plan, 12)).toBeUndefined()
    })
})
