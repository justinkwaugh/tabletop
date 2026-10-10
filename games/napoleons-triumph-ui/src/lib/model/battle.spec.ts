import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { battleStage, emptyBattleDraft, type BattleDraft } from './battle.js'

const ATTACK_FROM = 95
const DEFEND_IN = 108

const PLACEMENTS: PiecePlacement[] = [
    { id: 'F-inf-a', side: Side.French, face: infantry(3), locale: ATTACK_FROM, commanderId: 'lannes' },
    { id: 'F-inf-b', side: Side.French, face: infantry(2), locale: ATTACK_FROM, commanderId: 'lannes' },
    { id: 'F-block', side: Side.French, face: infantry(2), locale: ATTACK_FROM, facing: DEFEND_IN },
    { id: 'A-inf-a', side: Side.Allied, face: infantry(2), locale: DEFEND_IN, commanderId: 'langeron' },
    { id: 'A-inf-b', side: Side.Allied, face: infantry(2), locale: DEFEND_IN, commanderId: 'langeron' },
    { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: DEFEND_IN }
]

/** The French turn of the first round with a threat made across the approach between the two locales. */
function threatened(placements: readonly PiecePlacement[] = PLACEMENTS): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach })
    return game
}

function stageOf(game: TestGame, draft: BattleDraft, plannedUnitIds?: string[]) {
    const state = game.hydrated
    const attack = state.attack
    if (!attack) {
        throw new Error('Expected an attack in progress')
    }
    const planned = plannedUnitIds ? { kind: CommandKind.Corps, unitIds: plannedUnitIds } : undefined
    const stage = battleStage(state, attack, draft, planned)
    if (!stage) {
        throw new Error('Expected a picking stage')
    }
    return stage
}

function tap(game: TestGame, draft: BattleDraft, unitId: string): BattleDraft {
    return { ...draft, ...stageOf(game, draft).pick(unitId), touched: true }
}

describe('picking a defence', () => {
    it('takes a reserve unit from standing by, to defending, to leading, and back', () => {
        const game = threatened()
        let draft = emptyBattleDraft()
        expect(stageOf(game, draft).candidates.map((unit) => unit.id)).toEqual(['A-inf-a', 'A-inf-b', 'A-cav'])

        draft = tap(game, draft, 'A-inf-a')
        expect(stageOf(game, draft).roles).toEqual({ 'A-inf-a': 'defends' })

        draft = tap(game, draft, 'A-inf-a')
        expect(stageOf(game, draft).roles).toEqual({ 'A-inf-a': 'leads' })

        draft = tap(game, draft, 'A-inf-a')
        expect(stageOf(game, draft).picked).toEqual([])
    })

    it('keeps no more leading units than the approach is wide', () => {
        const game = threatened()
        const wide = game.hydrated.map.approachBetween(DEFEND_IN, ATTACK_FROM).wide
        let draft = emptyBattleDraft()
        for (const unitId of ['A-inf-a', 'A-inf-a', 'A-inf-b', 'A-inf-b', 'A-cav', 'A-cav']) {
            draft = tap(game, draft, unitId)
        }
        const stage = stageOf(game, draft)
        expect(stage.picked).toEqual(['A-inf-a', 'A-inf-b', 'A-cav'])
        expect(stage.leaders).toEqual(wide ? ['A-inf-b', 'A-cav'] : ['A-cav'])
    })

    it('says why a pick cannot be declared', () => {
        const game = threatened([
            ...PLACEMENTS,
            { id: 'A-cav-b', side: Side.Allied, face: cavalry(1), locale: DEFEND_IN }
        ])
        const two = { ...emptyBattleDraft(), touched: true, pieces: ['A-cav', 'A-cav-b'] }
        expect(stageOf(game, two).problem).toMatch(/one detached unit/)
        const weakLeader = { ...emptyBattleDraft(), touched: true, pieces: ['A-cav-b'], leaders: ['A-cav-b'] }
        expect(stageOf(game, weakLeader).problem).toMatch(/one-strength/)
        const sound = { ...emptyBattleDraft(), touched: true, pieces: ['A-inf-a', 'A-cav'], leaders: ['A-inf-a'] }
        expect(stageOf(game, sound).problem).toBeUndefined()
    })

    it('names every piece on the approach without being asked', () => {
        const game = threatened([
            ...PLACEMENTS,
            { id: 'A-block', side: Side.Allied, face: infantry(2), locale: DEFEND_IN, facing: ATTACK_FROM }
        ])
        const stage = stageOf(game, emptyBattleDraft())
        expect(stage.candidates.map((unit) => unit.id)).toEqual(['A-block'])
        expect(stage.picked).toEqual(['A-block'])
        expect(stage.pick('A-block')).toEqual({ pieces: ['A-block'], leaders: ['A-block'] })
    })
})

describe('picking the attackers', () => {
    function standing(): TestGame {
        const game = threatened()
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf-a'],
            leaderIds: ['A-inf-a']
        })
        return game
    }

    it('starts from the pieces that made the threat and moves them by their commander', () => {
        const game = standing()
        const stage = stageOf(game, emptyBattleDraft(), ['F-inf-a', 'F-inf-b'])
        expect(stage.picked).toEqual(['F-inf-a', 'F-inf-b'])
        expect(stage.orders).toEqual([
            { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-inf-a', 'F-inf-b'] }
        ])
    })

    it('starts over when a unit standing somewhere else is picked', () => {
        const game = standing()
        const draft = { ...emptyBattleDraft(), touched: true, pieces: ['F-inf-a', 'F-inf-b'] }
        expect(stageOf(game, draft).pick('F-block')).toEqual({ pieces: ['F-block'] })
    })

    it('moves a detached unit by an independent command', () => {
        const game = standing()
        const draft = { ...emptyBattleDraft(), touched: true, pieces: ['F-block'] }
        expect(stageOf(game, draft).orders).toEqual([{ kind: CommandKind.Unit, unitIds: ['F-block'] }])
    })

    it('has no command to offer when nothing is picked', () => {
        const game = standing()
        const draft = { ...emptyBattleDraft(), touched: true }
        expect(stageOf(game, draft).orders).toBeUndefined()
    })
})

describe('picking guns to fire', () => {
    const GUNS: PiecePlacement[] = [
        { id: 'F-art', side: Side.French, face: artillery(), locale: ATTACK_FROM, facing: DEFEND_IN, commanderId: 'lannes' },
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM, facing: DEFEND_IN, commanderId: 'lannes' },
        { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: DEFEND_IN }
    ]

    function pressed(): TestGame {
        const game = threatened(GUNS)
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), { unitIds: ['A-inf'], leaderIds: [] })
        game.act(ActionType.PressAttack, game.playerOf(Side.French))
        return game
    }

    it('detaches a battery picked by itself so that it can lead', () => {
        const game = pressed()
        const draft = { ...emptyBattleDraft(), touched: true, pieces: ['F-art'], leaders: ['F-art'] }
        const stage = stageOf(game, draft)
        expect(stage.orders).toEqual([{ kind: CommandKind.Detach, commanderId: 'lannes', unitIds: ['F-art'] }])
        expect(stage.problem).toBeUndefined()
        game.act(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: stage.orders,
            wide: false,
            leaderIds: stage.leaders
        })
        expect(game.hydrated.findUnit('A-inf')?.face).toEqual(infantry(1))
    })

    it('explains that a whole corps cannot be led by its battery', () => {
        const game = pressed()
        const draft = { ...emptyBattleDraft(), touched: true, pieces: ['F-art', 'F-inf'], leaders: ['F-art'] }
        expect(stageOf(game, draft).problem).toMatch(/Corps Move attack cannot be led by artillery/)
    })
})
