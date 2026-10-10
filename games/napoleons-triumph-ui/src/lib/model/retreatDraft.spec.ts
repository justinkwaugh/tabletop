import { describe, expect, it } from 'vitest'
import { ActionType, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { emptyBattleDraft } from './battle.js'
import { retreatDraft } from './retreatDraft.js'

const ATTACK_FROM = 95
const DEFEND_IN = 108

const PLACEMENTS: PiecePlacement[] = [
    { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
    { id: 'A-inf-a', side: Side.Allied, face: infantry(3), locale: DEFEND_IN, commanderId: 'langeron' },
    { id: 'A-inf-b', side: Side.Allied, face: infantry(1), locale: DEFEND_IN, commanderId: 'langeron' },
    { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: DEFEND_IN },
    { id: 'A-art', side: Side.Allied, face: artillery(), locale: DEFEND_IN }
]

function threatened(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, PLACEMENTS)
    const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach })
    return game
}

describe('arranging a retreat', () => {
    it('suggests losses that cost no unit, and a plan the rules accept', () => {
        const game = threatened()
        const plan = retreatDraft(game.hydrated, emptyBattleDraft())
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
        const base = retreatDraft(game.hydrated, emptyBattleDraft())
        const [elsewhere] = [...base.room.keys()].filter(
            (locale) => locale !== base.destinations['A-cav'] && (base.room.get(locale) ?? 0) > 0
        )
        const plan = retreatDraft(game.hydrated, {
            ...emptyBattleDraft(),
            destinations: { 'A-cav': elsewhere }
        })
        expect(plan.destinations['A-cav']).toBe(elsewhere)
        expect(plan.destinations['A-inf-a']).toBe(base.destinations['A-inf-a'])
    })

    it('reports losses that do not add up', () => {
        const game = threatened()
        const plan = retreatDraft(game.hydrated, { ...emptyBattleDraft(), allocation: { 'A-inf-b': 1 } })
        const owed = plan.groups.reduce((sum, group) => sum + group.steps, 0)
        expect(plan.lossesValid).toBe(owed === 1)
        expect(plan.survivors.map((unit) => unit.id)).toEqual(['A-inf-a', 'A-cav'])
    })
})
