import { describe, expect, it } from 'vitest'
import {
    TargetKind,
    TargetMark,
    approachTarget,
    markOf,
    marksOn,
    reserveTarget,
    retreatTargets,
    threatenedApproaches
} from './targets.js'

describe('places to go', () => {
    it('are told apart by what they are and where, so one place is offered once', () => {
        const keys = [
            reserveTarget(94).key,
            reserveTarget(95).key,
            approachTarget({ locale: 94, approach: 300 }).key,
            approachTarget({ locale: 94, approach: 301 }).key,
            ...retreatTargets([94]).map((target) => target.key)
        ]
        expect(new Set(keys).size).toBe(keys.length)
        expect(reserveTarget(94, { road: [93, 94] }).key).toBe(reserveTarget(94).key)
    })

    it('for a retreat are one locale each, with no road to them', () => {
        expect(
            retreatTargets(
                new Map([
                    [83, 2],
                    [84, 1]
                ]).keys()
            )
        ).toEqual([
            expect.objectContaining({ kind: TargetKind.Retreat, position: { locale: 83 } }),
            expect.objectContaining({ kind: TargetKind.Retreat, position: { locale: 84 } })
        ])
    })
})

describe('the marks of the places to go', () => {
    const march = reserveTarget(95, { road: [94, 95] })
    const move = reserveTarget(94)
    const block = approachTarget({ locale: 94, approach: 300 })
    const [retreat] = retreatTargets([83])

    it('draw a road march apart from a plain move, and a retreat as a move', () => {
        expect(markOf(move)).toBe(TargetMark.Move)
        expect(markOf(march)).toBe(TargetMark.RoadMarch)
        expect(markOf(block)).toBe(TargetMark.Approach)
        expect(markOf(retreat)).toBe(TargetMark.Move)
    })

    it('are listed once each in the order of the legend, only those on the map', () => {
        expect(marksOn([block, march, move, march])).toEqual([
            TargetMark.Move,
            TargetMark.RoadMarch,
            TargetMark.Approach
        ])
        expect(marksOn([])).toEqual([])
    })

    it('carry no arrow to keep clear of unless a threat is on offer', () => {
        expect(threatenedApproaches([move, march, block, retreat])).toEqual([])
    })
})
