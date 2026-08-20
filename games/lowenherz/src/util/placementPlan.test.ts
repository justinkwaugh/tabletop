import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { buildPlacementPlan, currentPlacementSlot, isSetupComplete } from './placementPlan.js'

describe('buildPlacementPlan', () => {
    it('builds 12 total placements for a 4-player game with no neutral color', () => {
        const turnOrder = ['p1', 'p2', 'p3', 'p4']
        const colors: Record<string, Color> = {
            p1: Color.Pink,
            p2: Color.Yellow,
            p3: Color.Purple,
            p4: Color.Gray
        }
        const plan = buildPlacementPlan(turnOrder, (id) => colors[id], undefined)

        expect(plan.length).toBe(12)
        expect(plan.every((slot) => slot.color === colors[slot.playerId])).toBe(true)
        // Round-robin: p1,p2,p3,p4 repeated 3 times
        expect(plan.map((s) => s.playerId)).toEqual([
            'p1', 'p2', 'p3', 'p4',
            'p1', 'p2', 'p3', 'p4',
            'p1', 'p2', 'p3', 'p4'
        ])
    })

    it('builds 12 total placements for a 3-player game: 9 own + 3 neutral', () => {
        const turnOrder = ['p1', 'p2', 'p3']
        const colors: Record<string, Color> = { p1: Color.Pink, p2: Color.Yellow, p3: Color.Purple }
        const plan = buildPlacementPlan(turnOrder, (id) => colors[id], Color.Gray)

        expect(plan.length).toBe(12)
        expect(plan.slice(0, 9).every((slot) => slot.color === colors[slot.playerId])).toBe(true)
        expect(plan.slice(9, 12).every((slot) => slot.color === Color.Gray)).toBe(true)
        expect(plan.slice(9, 12).map((s) => s.playerId)).toEqual(['p1', 'p2', 'p3'])
    })

    it('builds 12 total placements for a 2-player game: 8 own + 4 neutral', () => {
        const turnOrder = ['p1', 'p2']
        const colors: Record<string, Color> = { p1: Color.Pink, p2: Color.Yellow }
        const plan = buildPlacementPlan(turnOrder, (id) => colors[id], Color.Purple)

        expect(plan.length).toBe(12)
        expect(plan.slice(0, 8).every((slot) => slot.color === colors[slot.playerId])).toBe(true)
        expect(plan.slice(8, 12).every((slot) => slot.color === Color.Purple)).toBe(true)
    })

    it('throws if neutralColor is missing for a 2 or 3 player game', () => {
        expect(() => buildPlacementPlan(['p1', 'p2', 'p3'], () => Color.Pink, undefined)).toThrow()
        expect(() => buildPlacementPlan(['p1', 'p2'], () => Color.Pink, undefined)).toThrow()
    })
})

describe('currentPlacementSlot / isSetupComplete', () => {
    it('walks through the plan in order and completes at the end', () => {
        const plan = buildPlacementPlan(
            ['p1', 'p2', 'p3', 'p4'],
            () => Color.Pink,
            undefined
        )

        expect(isSetupComplete(plan, 0)).toBe(false)
        expect(currentPlacementSlot(plan, 0)?.playerId).toBe('p1')
        expect(currentPlacementSlot(plan, 11)?.playerId).toBe('p4')
        expect(isSetupComplete(plan, 11)).toBe(false)
        expect(isSetupComplete(plan, 12)).toBe(true)
        expect(currentPlacementSlot(plan, 12)).toBeUndefined()
    })
})
