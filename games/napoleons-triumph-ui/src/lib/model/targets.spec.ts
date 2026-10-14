import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import { frenchTurn, infantry, waitOffMap } from '@tabletop/napoleons-triumph/testing'
import {
    TargetKind,
    TargetMark,
    approachTarget,
    markOf,
    marksOn,
    moveTargets,
    placeReachedSeveralWays,
    reserveTarget,
    retreatTargets,
    threatenedApproaches,
    wayTargets
} from './targets.js'
import { WayStepKind, type WayStep } from './ways.js'

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
        expect(reserveTarget(94, [{ road: [93, 94] }]).key).toBe(reserveTarget(94).key)
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
    const march = reserveTarget(95, [{ road: [94, 95] }])
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

describe('the ways to a place by road (rule 10)', () => {
    const START = 38
    const DESTINATION = 53
    const BY_THE_NORTH = 39
    const BY_THE_SOUTH = 52

    function marching(units: number) {
        const game = frenchTurn(
            Array.from({ length: units }, (_, index) => ({
                id: `F-${index + 1}`,
                side: Side.French,
                face: infantry(2),
                locale: START,
                commanderId: 'lannes'
            }))
        )
        const order = {
            kind: CommandKind.Corps,
            commanderId: 'lannes',
            unitIds: game.hydrated.corpsUnits('lannes').map((unit) => unit.id)
        }
        const targets = moveTargets(game.hydrated, game.playerOf(Side.French), order)
        return { game, order, targets, key: reserveTarget(DESTINATION).key }
    }

    it('are all kept for a corps of two or more units, which closes the reserves it marches into', () => {
        const { targets, key } = marching(2)
        expect(placeReachedSeveralWays(targets, key)?.ways).toEqual([
            { road: [BY_THE_NORTH, DESTINATION] },
            { road: [BY_THE_SOUTH, DESTINATION] }
        ])
    })

    it('are one way for a single unit, which closes nothing', () => {
        const { targets, key } = marching(1)
        expect(placeReachedSeveralWays(targets, key)).toBeUndefined()
        expect(targets.find((target) => target.key === key)).toMatchObject({
            ways: [{ road: [BY_THE_NORTH, DESTINATION] }]
        })
    })

    it('each leave the reserve of the other open to a unit that follows', () => {
        for (const [taken, spared] of [
            [BY_THE_NORTH, BY_THE_SOUTH],
            [BY_THE_SOUTH, BY_THE_NORTH]
        ]) {
            const { game, order } = marching(2)
            game.act(ActionType.Move, game.playerOf(Side.French), {
                order: { ...order, road: [taken, DESTINATION] },
                to: { locale: DESTINATION }
            })
            expect(game.hydrated.limits.marchedLocales).toEqual([taken, DESTINATION])
            expect(game.hydrated.limits.marchedLocales).not.toContain(spared)
        }
    })

    it('are told apart, for reinforcements, by the road they come on by', () => {
        const ENTRY_LOCALE = 89
        const game = frenchTurn([{ id: 'A-far', side: Side.Allied, face: infantry(1), locale: 20 }])
        waitOffMap(game, 'bernadotte', [{ id: 'F-off', face: infantry(2) }])
        const state = game.hydrated
        const order = { kind: CommandKind.Corps, commanderId: 'bernadotte', unitIds: ['F-off'] }
        const entries = state.map.entries(Side.French).map((entry) => entry.id)
        const targets = moveTargets(state, game.playerOf(Side.French), order, entries)
        const comingOn = placeReachedSeveralWays(targets, reserveTarget(ENTRY_LOCALE).key)
        expect(comingOn?.ways).toEqual([
            { entryId: 'F5', road: [ENTRY_LOCALE] },
            { entryId: 'F6', road: [ENTRY_LOCALE] },
            { entryId: 'F7', road: [ENTRY_LOCALE] }
        ])
    })

    it('are drawn as steps to tap, each a road march', () => {
        const through: WayStep = { kind: WayStepKind.Locale, key: 'locale:39', locale: 39 }
        const comingOn: WayStep = {
            kind: WayStepKind.Entry,
            key: 'entry:F5',
            locale: 89,
            entryId: 'F5'
        }
        const steps = wayTargets([through, comingOn])
        expect(steps).toEqual([
            { key: 'locale:39', kind: TargetKind.Way, position: { locale: 39 }, step: through },
            { key: 'entry:F5', kind: TargetKind.Way, position: { locale: 89 }, step: comingOn }
        ])
        expect(marksOn(steps)).toEqual([TargetMark.Way])
    })
})
