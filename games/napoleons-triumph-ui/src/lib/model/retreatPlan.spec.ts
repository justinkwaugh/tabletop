import { describe, expect, it } from 'vitest'
import { ActionType, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry
} from '@tabletop/napoleons-triumph/testing'
import { RetreatFate, retreatPlan, type RetreatPlan } from './retreatPlan.js'

const ATTACK_FROM = 95
const DEFEND_IN = 108

function threatened(surrounding: readonly number[] = []): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, [
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
        ...surrounding.map((locale) => ({
            id: `F-around-${locale}`,
            side: Side.French,
            face: infantry(2),
            locale
        })),
        {
            id: 'A-inf-a',
            side: Side.Allied,
            face: infantry(3),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        },
        {
            id: 'A-inf-b',
            side: Side.Allied,
            face: infantry(1),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        },
        { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: DEFEND_IN },
        { id: 'A-art', side: Side.Allied, face: artillery(), locale: DEFEND_IN }
    ])
    const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach })
    return game
}

function fatesIn(plan: RetreatPlan): Record<string, RetreatFate> {
    return Object.fromEntries(plan.units.map(({ unit, fate }) => [unit.id, fate]))
}

describe('arranging a retreat', () => {
    it('suggests losses that cost no unit, and a plan the rules accept', () => {
        const game = threatened()
        const plan = retreatPlan(game.hydrated, {})
        const owed = plan.groups.reduce((sum, group) => sum + group.steps, 0)
        expect(owed).toBeGreaterThan(0)
        expect(plan.losses).toEqual({ 'A-inf-a': owed })
        expect(plan.lossesValid).toBe(true)
        expect(plan.survivors.map((unit) => unit.id)).toEqual(['A-inf-a', 'A-inf-b', 'A-cav'])
        expect(plan.kept).toEqual({ langeron: 'A-inf-a' })

        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: plan.losses,
            destinations: plan.destinations,
            kept: plan.kept
        })
        expect(game.hydrated.findUnit('A-art')).toBeUndefined()
        expect(game.hydrated.unitsIn(DEFEND_IN, game.playerOf(Side.Allied))).toEqual([])
    })

    it('sends a unit where the player asks and the rest where there is most room', () => {
        const game = threatened()
        const suggested = retreatPlan(game.hydrated, {})
        const [elsewhere] = [...suggested.room.keys()].filter(
            (locale) =>
                locale !== suggested.destinations['A-cav'] && (suggested.room.get(locale) ?? 0) > 0
        )
        const asked = { destinations: [{ unitId: 'A-cav', locale: elsewhere }] }
        const plan = retreatPlan(game.hydrated, asked)
        expect(plan.destinations['A-cav']).toBe(elsewhere)
        expect(plan.destinations['A-inf-a']).toBe(suggested.destinations['A-inf-a'])
    })

    it('reports losses that do not add up', () => {
        const game = threatened()
        const chosen = { losses: { 'A-inf-b': 1 } }
        const plan = retreatPlan(game.hydrated, chosen)
        const owed = plan.groups.reduce((sum, group) => sum + group.steps, 0)
        expect(plan.lossesValid).toBe(owed === 1)
        expect(plan.survivors.map((unit) => unit.id)).toEqual(['A-inf-a', 'A-cav'])
    })

    it('tells what becomes of each unit: guns are lost and the rest go with the steps they lose', () => {
        const plan = retreatPlan(threatened().hydrated, {})
        expect(fatesIn(plan)).toEqual({
            'A-inf-a': RetreatFate.Retreats,
            'A-inf-b': RetreatFate.Retreats,
            'A-cav': RetreatFate.Retreats,
            'A-art': RetreatFate.GunsLost
        })
        const struck = plan.units.find(({ unit }) => unit.id === 'A-inf-a')
        expect(struck).toMatchObject({
            loss: plan.losses['A-inf-a'],
            destination: plan.destinations['A-inf-a']
        })
        expect(plan.groups.flatMap((group) => group.unitIds)).toContain('A-inf-a')
        const guns = plan.units.find(({ unit }) => unit.id === 'A-art')
        expect(guns).toMatchObject({ loss: 0, destination: undefined })
    })

    it('counts a unit eliminated once it loses every step it has', () => {
        const chosen = { losses: { 'A-inf-b': 1 } }
        const plan = retreatPlan(threatened().hydrated, chosen)
        expect(fatesIn(plan)['A-inf-b']).toBe(RetreatFate.Eliminated)
        expect(plan.destinations['A-inf-b']).toBeUndefined()
    })

    it('finds no room for units whose every way out is held by the enemy', () => {
        const state = threatened().hydrated
        const waysOut = state.map
            .adjacentLocales(DEFEND_IN)
            .filter((locale) => locale !== ATTACK_FROM)
        const plan = retreatPlan(threatened(waysOut).hydrated, {})
        expect(plan.room.size).toBe(0)
        expect(fatesIn(plan)).toMatchObject({
            'A-inf-a': RetreatFate.NoRoom,
            'A-cav': RetreatFate.NoRoom,
            'A-art': RetreatFate.GunsLost
        })
    })

    it('gives what room there is to the units asked for last, and counts the rest as lost', () => {
        const state = threatened().hydrated
        const [open, ...closed] = state.map
            .adjacentLocales(DEFEND_IN)
            .filter((locale) => locale !== ATTACK_FROM)
        const game = threatened(closed)
        game.arrange((arranged) => {
            arranged.units.push({
                id: 'A-crowd',
                playerId: game.playerOf(Side.Allied),
                face: infantry(2),
                position: { locale: open }
            })
        })
        const room = game.hydrated.map.locale(open).capacity - 1
        const suggested = retreatPlan(game.hydrated, {})
        expect(Object.keys(suggested.destinations)).toHaveLength(Math.min(room, 3))
        expect(suggested.stranded).toBe(3 - Math.min(room, 3))

        const everyone = ['A-inf-a', 'A-inf-b', 'A-cav']
        const lastAsked = everyone.toReversed().map((unitId) => ({ unitId, locale: open }))
        const plan = retreatPlan(game.hydrated, { destinations: lastAsked })
        const saved = lastAsked.slice(0, Math.min(room, 3)).map(({ unitId }) => unitId)
        expect(Object.keys(plan.destinations).toSorted()).toEqual(saved.toSorted())
    })

    it('counts for each group the steps assigned against the steps it owes', () => {
        const game = threatened()
        const suggested = retreatPlan(game.hydrated, {})
        expect(suggested.groups.length).toBeGreaterThan(0)
        for (const group of suggested.groups) {
            expect(group.assigned).toBe(group.steps)
        }
        const none = { losses: {} }
        const unassigned = retreatPlan(game.hydrated, none)
        expect(unassigned.groups.map((group) => group.assigned)).toEqual(
            unassigned.groups.map(() => 0)
        )
        expect(unassigned.lossesValid).toBe(false)
    })
})
