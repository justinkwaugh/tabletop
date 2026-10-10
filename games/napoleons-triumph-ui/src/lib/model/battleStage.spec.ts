import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, FeintEnd, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { emptyBattleSelections, type BattleSelections } from './battleSelection.js'
import { BattleRole, StageKind, battleStageOf, pickUnit, type BattleStage } from './battleStage.js'

const ATTACK_FROM = 95
const DEFEND_IN = 108

const PLACEMENTS: PiecePlacement[] = [
    {
        id: 'F-inf-a',
        side: Side.French,
        face: infantry(3),
        locale: ATTACK_FROM,
        commanderId: 'lannes'
    },
    {
        id: 'F-inf-b',
        side: Side.French,
        face: infantry(2),
        locale: ATTACK_FROM,
        commanderId: 'lannes'
    },
    { id: 'F-block', side: Side.French, face: infantry(2), locale: ATTACK_FROM, facing: DEFEND_IN },
    {
        id: 'A-inf-a',
        side: Side.Allied,
        face: infantry(2),
        locale: DEFEND_IN,
        commanderId: 'langeron'
    },
    {
        id: 'A-inf-b',
        side: Side.Allied,
        face: infantry(2),
        locale: DEFEND_IN,
        commanderId: 'langeron'
    },
    { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: DEFEND_IN }
]

function threatened(placements: readonly PiecePlacement[] = PLACEMENTS): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach })
    return game
}

function isStage<Kind extends StageKind>(
    stage: BattleStage | undefined,
    kind: Kind
): stage is Extract<BattleStage, { kind: Kind }> {
    return stage?.kind === kind
}

function stageOf<Kind extends StageKind>(
    game: TestGame,
    kind: Kind,
    selections: BattleSelections = emptyBattleSelections(),
    plannedUnitIds?: string[]
): Extract<BattleStage, { kind: Kind }> {
    const state = game.hydrated
    const attack = state.attack
    if (!attack) {
        throw new Error('Expected an attack in progress')
    }
    const planned = plannedUnitIds
        ? { kind: CommandKind.Corps, unitIds: plannedUnitIds }
        : undefined
    const stage = battleStageOf(state, attack, selections, planned)
    if (!isStage(stage, kind)) {
        throw new Error(`Expected the ${kind} stage, not ${stage?.kind}`)
    }
    return stage
}

function tap(game: TestGame, selections: BattleSelections, ...unitIds: string[]): BattleSelections {
    const state = game.hydrated
    const attack = state.attack
    if (!attack) {
        throw new Error('Expected an attack in progress')
    }
    return unitIds.reduce((current, unitId) => {
        const stage = battleStageOf(state, attack, current, undefined)
        if (!stage) {
            throw new Error('Expected a picking stage')
        }
        return pickUnit(state, stage, current, unitId)
    }, selections)
}

describe('naming a defence', () => {
    it('takes a reserve unit from standing by, to defending, to leading, and back', () => {
        const game = threatened()
        expect(stageOf(game, StageKind.Defence).pickableIds).toEqual([
            'A-inf-a',
            'A-inf-b',
            'A-cav'
        ])

        const defending = tap(game, emptyBattleSelections(), 'A-inf-a')
        expect(stageOf(game, StageKind.Defence, defending).roles).toEqual({
            'A-inf-a': BattleRole.Defends
        })

        const leading = tap(game, defending, 'A-inf-a')
        expect(stageOf(game, StageKind.Defence, leading).roles).toEqual({
            'A-inf-a': BattleRole.Leads
        })

        expect(stageOf(game, StageKind.Defence, tap(game, leading, 'A-inf-a')).defenders).toEqual(
            []
        )
    })

    it('keeps no more leading units than the approach is wide', () => {
        const game = threatened()
        const wide = game.hydrated.map.approachBetween(DEFEND_IN, ATTACK_FROM).wide
        const all = tap(
            game,
            emptyBattleSelections(),
            'A-inf-a',
            'A-inf-a',
            'A-inf-b',
            'A-inf-b',
            'A-cav',
            'A-cav'
        )
        const stage = stageOf(game, StageKind.Defence, all)
        expect(stage.defenders).toEqual(['A-inf-a', 'A-inf-b', 'A-cav'])
        expect(stage.leaders).toEqual(wide ? ['A-inf-b', 'A-cav'] : ['A-cav'])
    })

    it('says in the rules’ words why a pick cannot be declared', () => {
        const game = threatened([
            ...PLACEMENTS,
            { id: 'A-cav-b', side: Side.Allied, face: cavalry(1), locale: DEFEND_IN }
        ])
        const twoDetached = tap(game, emptyBattleSelections(), 'A-cav', 'A-cav-b')
        expect(stageOf(game, StageKind.Defence, twoDetached).problem).toMatch(/one detached unit/)
        const weakLeader = tap(game, emptyBattleSelections(), 'A-cav-b', 'A-cav-b')
        expect(stageOf(game, StageKind.Defence, weakLeader).problem).toMatch(/one-strength/)
        const sound = tap(game, emptyBattleSelections(), 'A-inf-a', 'A-inf-a', 'A-cav')
        expect(stageOf(game, StageKind.Defence, sound).problem).toBeUndefined()
    })

    it('names every piece on the approach without being asked', () => {
        const game = threatened([
            ...PLACEMENTS,
            {
                id: 'A-block',
                side: Side.Allied,
                face: infantry(2),
                locale: DEFEND_IN,
                facing: ATTACK_FROM
            }
        ])
        const stage = stageOf(game, StageKind.Defence)
        expect(stage.forced).toBe(true)
        expect(stage.defenders).toEqual(['A-block'])
        expect(
            stageOf(game, StageKind.Defence, tap(game, emptyBattleSelections(), 'A-block')).leaders
        ).toEqual(['A-block'])
    })
})

describe('naming the attack command', () => {
    function standing(): TestGame {
        const game = threatened()
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf-a'],
            leaderIds: ['A-inf-a']
        })
        return game
    }

    it('starts from the pieces that made the threat, moved by their commander', () => {
        const stage = stageOf(standing(), StageKind.Feint, emptyBattleSelections(), [
            'F-inf-a',
            'F-inf-b'
        ])
        expect(stage.attackers).toEqual(['F-inf-a', 'F-inf-b'])
        expect(stage.commandOptions).toEqual([CommandKind.Corps])
        expect(stage.orders).toEqual([
            { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-inf-a', 'F-inf-b'] }
        ])
        expect(stage.ends).toEqual([FeintEnd.Approach, FeintEnd.Reserve])
    })

    it('lets part of a corps go forward with its commander, without him, or by itself', () => {
        const game = standing()
        const one = tap(game, emptyBattleSelections(), 'F-inf-a')
        const stage = stageOf(game, StageKind.Feint, one)
        expect(stage.commandOptions).toEqual([
            CommandKind.Corps,
            CommandKind.Detach,
            CommandKind.Unit
        ])
        expect(stage.command).toBe(CommandKind.Corps)
    })

    it('starts over when a unit standing somewhere else is picked', () => {
        const game = standing()
        const corps = tap(game, emptyBattleSelections(), 'F-inf-a', 'F-inf-b')
        expect(stageOf(game, StageKind.Feint, tap(game, corps, 'F-block')).attackers).toEqual([
            'F-block'
        ])
    })

    it('feints in place from the approach by an independent command', () => {
        const game = standing()
        const stage = stageOf(game, StageKind.Feint, tap(game, emptyBattleSelections(), 'F-block'))
        expect(stage.orders).toEqual([{ kind: CommandKind.Unit, unitIds: ['F-block'] }])
        expect(stage.ends).toEqual([FeintEnd.Approach])
    })

    it('has no command to offer when nothing is picked', () => {
        const stage = stageOf(standing(), StageKind.Feint)
        expect(stage.orders).toBeUndefined()
        expect(stage.ends).toEqual([])
    })
})

describe('guns picked to fire', () => {
    const GUNS: PiecePlacement[] = [
        {
            id: 'F-art',
            side: Side.French,
            face: artillery(),
            locale: ATTACK_FROM,
            facing: DEFEND_IN,
            commanderId: 'lannes'
        },
        {
            id: 'F-inf',
            side: Side.French,
            face: infantry(3),
            locale: ATTACK_FROM,
            facing: DEFEND_IN,
            commanderId: 'lannes'
        },
        { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: DEFEND_IN }
    ]

    function pressed(): TestGame {
        const game = threatened(GUNS)
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        game.act(ActionType.PressAttack, game.playerOf(Side.French))
        return game
    }

    it('leave their corps to lead, and the engine accepts the declaration built', () => {
        const game = pressed()
        const stage = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-art', 'F-art')
        )
        expect(stage.command).toBe(CommandKind.Detach)
        expect(stage.problem).toBeUndefined()
        expect(stage.initialResult).toBe(1)
        game.act(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: stage.orders,
            wide: stage.wide,
            leaderIds: stage.leaders
        })
        expect(game.hydrated.findUnit('A-inf')?.face).toEqual(infantry(1))
    })

    it('cannot lead the whole corps', () => {
        const game = pressed()
        const stage = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-art', 'F-art', 'F-inf')
        )
        expect(stage.problem).toMatch(/Corps Move attack cannot be led by artillery/)
    })
})

describe('the forced advance', () => {
    it('sends a commander forward with the last unit standing with him', () => {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(game, [
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: DEFEND_IN },
            {
                id: 'F-1',
                side: Side.French,
                face: infantry(2),
                locale: ATTACK_FROM,
                commanderId: 'lannes'
            },
            {
                id: 'F-2',
                side: Side.French,
                face: infantry(2),
                locale: ATTACK_FROM,
                commanderId: 'lannes'
            }
        ])
        const allied = game.playerOf(Side.Allied)
        game.act(ActionType.ThreatenAttack, allied, {
            approach: game.hydrated.map.approachBetween(DEFEND_IN, ATTACK_FROM).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.French), {
            unitIds: ['F-1', 'F-2'],
            leaderIds: []
        })
        game.act(ActionType.DeclareFeint, allied, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        })
        const one = tap(game, emptyBattleSelections(), 'F-1')
        expect(stageOf(game, StageKind.Advance, one).commanders).toEqual([
            { commanderId: 'lannes', mustGo: false, goes: true }
        ])
        const both = tap(game, one, 'F-2')
        expect(stageOf(game, StageKind.Advance, both).commanders).toEqual([
            { commanderId: 'lannes', mustGo: true, goes: true }
        ])
    })
})
