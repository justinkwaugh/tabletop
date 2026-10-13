import { describe, expect, it } from 'vitest'
import { CommandKind, Side } from '@tabletop/napoleons-triumph'
import {
    artillery,
    frenchTurn,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import {
    TargetKind,
    TargetMark,
    approachTarget,
    markOf,
    marksOn,
    moveTargets,
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

describe('two artillery units given a Unit Move each', () => {
    const WIDE_FROM = 93
    const WIDE_INTO = 94
    const battery = (id: string, facing?: number): PiecePlacement => ({
        id,
        side: Side.French,
        face: artillery(),
        locale: WIDE_FROM,
        facing
    })
    const together = { kind: CommandKind.Unit, unitIds: ['F-a1', 'F-a2'] }

    it('can only threaten across the approach they block', () => {
        const game = frenchTurn([
            battery('F-a1', WIDE_INTO),
            battery('F-a2', WIDE_INTO),
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        const state = game.hydrated
        const approach = state.map.approachBetween(WIDE_FROM, WIDE_INTO).id
        expect(moveTargets(state, game.playerOf(Side.French), together)).toEqual([
            expect.objectContaining({
                kind: TargetKind.Attack,
                position: { locale: WIDE_FROM, approach }
            })
        ])
    })

    it('have nowhere to go with no enemy across it, or from reserve', () => {
        const unopposed = frenchTurn([battery('F-a1', WIDE_INTO), battery('F-a2', WIDE_INTO)])
        expect(moveTargets(unopposed.hydrated, unopposed.playerOf(Side.French), together)).toEqual(
            []
        )
        const inReserve = frenchTurn([
            battery('F-a1'),
            battery('F-a2'),
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        expect(moveTargets(inReserve.hydrated, inReserve.playerOf(Side.French), together)).toEqual(
            []
        )
    })
})
