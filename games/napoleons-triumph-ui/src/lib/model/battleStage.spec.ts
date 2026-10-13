import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { ActionType, CommandKind, FeintEnd, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import {
    AttackWidth,
    StageKind,
    chooseFeint,
    chooseRetreat,
    emptyBattleSelections,
    setAttackWidth,
    undoBattleSelection,
    type BattleSelections
} from './battleSelection.js'
import {
    BattleRole,
    battleLocalesOf,
    battleStageOf,
    commandersGoing,
    cycleLoss,
    keepWithCommander,
    keptByCommander,
    pickUnit,
    rolesShown,
    sendRetreatTo,
    toggleGoing,
    type BattleStage
} from './battleStage.js'

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

const WITH_LANNES = { kind: CommandKind.Corps, unitIds: ['F-inf-a', 'F-inf-b'] }

function threatened(
    placements: readonly PiecePlacement[] = PLACEMENTS,
    plan?: typeof WITH_LANNES
): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    game.act(
        ActionType.ThreatenAttack,
        game.playerOf(Side.French),
        plan ? { approach, plan } : { approach }
    )
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
    selections: BattleSelections = emptyBattleSelections()
): Extract<BattleStage, { kind: Kind }> {
    const state = game.hydrated
    const attack = state.attack
    if (!attack) {
        throw new Error('Expected an attack in progress')
    }
    const stage = battleStageOf(state, attack, selections)
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
        const stage = battleStageOf(state, attack, current)
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

describe('arranging a retreat', () => {
    function retreating(placements: readonly PiecePlacement[]) {
        const game = threatened(placements)
        const selections = emptyBattleSelections()
        return {
            game,
            selections: {
                ...selections,
                defence: chooseRetreat(selections.defence)
            }
        }
    }

    it('lets any unit be sent a different way from the rest', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.pickableIds.toSorted()).toEqual(['A-cav', 'A-inf-a', 'A-inf-b'])

        const parted = stageOf(game, StageKind.Retreat, tap(game, selections, 'A-cav'))
        expect(parted.alone).toBe('A-cav')
        expect(parted.roles).toEqual({ 'A-cav': BattleRole.RetreatsAlone })
    })

    it('offers nothing to send separately when only one unit retreats', () => {
        const alone = PLACEMENTS.filter(
            (piece) => piece.side === Side.French || piece.id === 'A-cav'
        )
        const { game, selections } = retreating(alone)
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.plan.room.size).toBeGreaterThan(1)
        expect(stage.pickableIds).toEqual([])
        expect(stage.alone).toBeUndefined()
    })

    it('steps a unit through every loss it could take and back to none', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const lossAfterTaps = (taps: number) => {
            let current = selections
            for (let tapped = 0; tapped < taps; tapped++) {
                const stage = stageOf(game, StageKind.Retreat, current)
                current = cycleLoss(game.hydrated, stage, current, 'A-cav')
            }
            return stageOf(game, StageKind.Retreat, current).plan.losses['A-cav'] ?? 0
        }
        const suggested = lossAfterTaps(0)
        const strength = 2
        expect([1, 2, 3].map(lossAfterTaps)).toEqual(
            [1, 2, 3].map((taps) => (suggested + taps) % (strength + 1))
        )
    })

    it('sends only the unit picked to go by itself to the locale tapped, and is then done with it', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const together = stageOf(game, StageKind.Retreat, selections)
        const [elsewhere] = [...together.plan.room.keys()].filter(
            (locale) =>
                locale !== together.plan.destinations['A-cav'] &&
                (together.plan.room.get(locale) ?? 0) > 0
        )
        const parting = tap(game, selections, 'A-cav')
        const sent = sendRetreatTo(stageOf(game, StageKind.Retreat, parting), parting, elsewhere)
        const stage = stageOf(game, StageKind.Retreat, sent)
        expect(stage.plan.destinations['A-cav']).toBe(elsewhere)
        expect(stage.plan.destinations['A-inf-a']).toBe(together.plan.destinations['A-inf-a'])
        expect(stage.alone).toBeUndefined()
    })

    it('sends every unit that can still retreat when none is picked to go by itself', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const stage = stageOf(game, StageKind.Retreat, selections)
        const [roomiest] = [...stage.plan.room].toSorted((a, b) => b[1] - a[1])
        const sent = stageOf(game, StageKind.Retreat, sendRetreatTo(stage, selections, roomiest[0]))
        const there = Object.values(sent.plan.destinations).filter(
            (locale) => locale === roomiest[0]
        )
        expect(there).toHaveLength(Math.min(roomiest[1], stage.plan.survivors.length))
    })

    it('lets the player save a unit there is no room for, at the cost of another (rule 12)', () => {
        const waysOut = new TestGame().hydrated.map
            .adjacentLocales(DEFEND_IN)
            .filter((locale) => locale !== ATTACK_FROM)
        const [open, ...closed] = waysOut
        const blockade: PiecePlacement[] = closed.map((locale) => ({
            id: `F-around-${locale}`,
            side: Side.French,
            face: infantry(2),
            locale
        }))
        const capacity = new TestGame().hydrated.map.locale(open).capacity
        const crowd: PiecePlacement[] = Array.from({ length: capacity - 1 }, (_, index) => ({
            id: `A-crowd-${index}`,
            side: Side.Allied,
            face: infantry(2),
            locale: open
        }))
        const { game, selections } = retreating([...PLACEMENTS, ...blockade, ...crowd])
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.plan.stranded).toBe(stage.plan.survivors.length - 1)
        expect(stage.pickableIds.toSorted()).toEqual(
            stage.plan.survivors.map((unit) => unit.id).toSorted()
        )
        const [saved] = Object.keys(stage.plan.destinations)
        const lost = stage.plan.survivors.map((unit) => unit.id).find((id) => id !== saved)
        assertExists(lost, 'Expected a unit with no room')

        const swapped = stageOf(game, StageKind.Retreat, tap(game, selections, lost))
        expect(swapped.alone).toBeUndefined()
        expect(Object.keys(swapped.plan.destinations)).toEqual([lost])
        expect(swapped.plan.destinations[lost]).toBe(open)

        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: swapped.plan.losses,
            destinations: swapped.plan.destinations,
            kept: swapped.plan.kept
        })
        expect(game.hydrated.findUnit(lost)?.position).toEqual({ locale: open })
        expect(game.hydrated.findUnit(saved)).toBeUndefined()
    })

    it('keeps the unit tapped with its commander', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.plan.kept).toEqual({ langeron: 'A-inf-a' })
        const kept = keepWithCommander(stage, selections, 'langeron', 'A-inf-b')
        expect(stageOf(game, StageKind.Retreat, kept).plan.kept).toEqual({ langeron: 'A-inf-b' })
    })
})

function standing(plan?: typeof WITH_LANNES): TestGame {
    const game = threatened(PLACEMENTS, plan)
    game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
        unitIds: ['A-inf-a'],
        leaderIds: ['A-inf-a']
    })
    return game
}

function feinting(): BattleSelections {
    const selections = emptyBattleSelections()
    return {
        ...selections,
        attackers: chooseFeint(selections.attackers)
    }
}

describe('when the defence stands', () => {
    it('asks only whether to press or feint, with no pieces to name', () => {
        const stage = stageOf(standing(WITH_LANNES), StageKind.Feint)
        expect(stage.canPress).toBe(true)
        expect(stage.feinting).toBe(false)
        expect(stage.pickableIds).toEqual([])
        expect(stage.roles).toEqual({})
        expect(stage.ends).toEqual([])
    })

    it('offers the pieces once a feint is called, and Undo takes that back last', () => {
        const game = standing()
        const stage = stageOf(game, StageKind.Feint, feinting())
        expect(stage.feinting).toBe(true)
        expect(stage.pickableIds).toEqual(expect.arrayContaining(['F-inf-a', 'F-inf-b']))

        const picked = tap(game, feinting(), 'F-inf-a')
        const unpicked = undoBattleSelection(picked, StageKind.Feint)
        expect(stageOf(game, StageKind.Feint, unpicked).feinting).toBe(true)
        expect(
            stageOf(game, StageKind.Feint, undoBattleSelection(unpicked, StageKind.Feint)).feinting
        ).toBe(false)
    })
})

describe('naming the attack command', () => {
    it('starts from the pieces that made the threat, moved by their commander', () => {
        const stage = stageOf(standing(WITH_LANNES), StageKind.Feint, feinting())
        expect(stage.attackers).toEqual(['F-inf-a', 'F-inf-b'])
        expect(stage.commandOptions).toEqual([CommandKind.Corps])
        expect(stage.orders).toEqual([
            { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-inf-a', 'F-inf-b'] }
        ])
        expect(stage.ends).toEqual([FeintEnd.Approach, FeintEnd.Reserve])
    })

    it('starts the declaration from them too, however the game was loaded, and from nothing when none were given', () => {
        const planned = standing(WITH_LANNES)
        planned.act(ActionType.PressAttack, planned.playerOf(Side.French))
        const stage = stageOf(planned, StageKind.Declaration)
        expect(stage.startsFromThreat).toBe(true)
        expect(stage.attackers).toEqual(['F-inf-a', 'F-inf-b'])
        expect(stage.command).toBe(CommandKind.Corps)

        const unplanned = standing()
        unplanned.act(ActionType.PressAttack, unplanned.playerOf(Side.French))
        const bare = stageOf(unplanned, StageKind.Declaration)
        expect(bare.startsFromThreat).toBe(false)
        expect(bare.attackers).toEqual([])
    })

    it('lets part of a corps go forward with its commander, without him, or by itself', () => {
        const game = standing()
        const one = tap(game, feinting(), 'F-inf-a')
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
        const corps = tap(game, feinting(), 'F-inf-a', 'F-inf-b')
        expect(stageOf(game, StageKind.Feint, tap(game, corps, 'F-block')).attackers).toEqual([
            'F-block'
        ])
    })

    it('feints in place from the approach by an independent command', () => {
        const game = standing()
        const stage = stageOf(game, StageKind.Feint, tap(game, feinting(), 'F-block'))
        expect(stage.orders).toEqual([{ kind: CommandKind.Unit, unitIds: ['F-block'] }])
        expect(stage.ends).toEqual([FeintEnd.Approach])
    })

    it('has no command to offer when nothing is picked', () => {
        const stage = stageOf(standing(), StageKind.Feint, feinting())
        expect(stage.orders).toBeUndefined()
        expect(stage.ends).toEqual([])
    })
})

describe('the width of an attack and its leading units', () => {
    const WIDE_FROM = 93
    const WIDE_INTO = 94

    function declaring(): TestGame {
        const lannes = (id: string) => ({
            id,
            side: Side.French,
            face: infantry(3),
            locale: WIDE_FROM,
            commanderId: 'lannes'
        })
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            lannes('F-a'),
            lannes('F-b'),
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: WIDE_INTO }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(WIDE_FROM, WIDE_INTO).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        game.act(ActionType.PressAttack, french)
        return game
    }

    function withWidth(selections: BattleSelections, width: AttackWidth): BattleSelections {
        return { ...selections, attackers: setAttackWidth(selections.attackers, width) }
    }

    it('drops only the second leading unit for a narrow attack, and has it back when wide again', () => {
        const game = declaring()
        const both = tap(game, emptyBattleSelections(), 'F-a', 'F-a', 'F-b', 'F-b')
        expect(stageOf(game, StageKind.Declaration, both).leaders).toEqual(['F-a', 'F-b'])

        const narrow = withWidth(both, AttackWidth.Narrow)
        const narrowed = stageOf(game, StageKind.Declaration, narrow)
        expect(narrowed.wide).toBe(false)
        expect(narrowed.leaders).toEqual(['F-a'])
        expect(narrowed.attackers).toEqual(['F-a', 'F-b'])

        const widened = stageOf(game, StageKind.Declaration, withWidth(narrow, AttackWidth.Wide))
        expect(widened.leaders).toEqual(['F-a', 'F-b'])
    })

    it('stays narrow when a leading unit is named after the width is chosen', () => {
        const game = declaring()
        const narrow = withWidth(emptyBattleSelections(), AttackWidth.Narrow)
        const led = stageOf(game, StageKind.Declaration, tap(game, narrow, 'F-a', 'F-a'))
        expect(led.wide).toBe(false)
        expect(led.leaders).toEqual(['F-a'])
    })
})

function struck(leaderId: string): TestGame {
    const game = threatened()
    const french = game.playerOf(Side.French)
    game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
        unitIds: ['A-inf-a', 'A-inf-b', 'A-cav'],
        leaderIds: ['A-inf-a']
    })
    game.act(ActionType.PressAttack, french)
    game.act(ActionType.DeclareAttack, french, {
        orders: [
            { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-inf-a', 'F-inf-b'] }
        ],
        wide: false,
        leaderIds: [leaderId]
    })
    return game
}

function foughtWithoutCounterAttack(leaderId: string): TestGame {
    const game = struck(leaderId)
    game.act(ActionType.CounterAttack, game.playerOf(Side.Allied), { unitIds: [] })
    return game
}

describe('the leading unit a narrow attack strikes', () => {
    const WIDE_FROM = 93
    const WIDE_INTO = 94

    function declaring(): TestGame {
        const defender = (id: string): PiecePlacement => ({
            id,
            side: Side.Allied,
            face: infantry(2),
            locale: WIDE_INTO,
            commanderId: 'bagration'
        })
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: WIDE_FROM },
            defender('A-1'),
            defender('A-2')
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(WIDE_FROM, WIDE_INTO).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-1', 'A-2'],
            leaderIds: ['A-1', 'A-2']
        })
        game.act(ActionType.PressAttack, french)
        return game
    }

    function narrow(game: TestGame, ...taps: string[]) {
        const named = tap(game, emptyBattleSelections(), 'F-inf', 'F-inf')
        const selections = {
            ...named,
            attackers: setAttackWidth(named.attackers, AttackWidth.Narrow)
        }
        return stageOf(game, StageKind.Declaration, tap(game, selections, ...taps))
    }

    it('is not asked for across the whole width', () => {
        const game = declaring()
        const stage = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-inf', 'F-inf')
        )
        expect(stage.targetOptions).toEqual([])
        expect(stage.pickableIds).not.toContain('A-1')
    })

    it('is the first until the other is tapped, on the map or on its tile, and the one passed by loses its mark', () => {
        const game = declaring()
        const first = narrow(game)
        expect(first.target).toBe('A-1')
        expect(first.pickableIds).toEqual(expect.arrayContaining(['A-1', 'A-2']))
        expect(first.roles['A-2']).toBe(BattleRole.PassedBy)
        expect(rolesShown(game.hydrated.attack, first)['A-1']).toBe(BattleRole.Leads)

        const second = narrow(game, 'A-2')
        expect(second.target).toBe('A-2')
        expect(second.roles['A-1']).toBe(BattleRole.PassedBy)
        expect(second.attackers).toEqual(['F-inf'])
        expect(second.leaders).toEqual(['F-inf'])
        expect(second.problem).toBeUndefined()

        game.act(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: second.orders,
            wide: second.wide,
            leaderIds: second.leaders,
            targetLeaderId: second.target
        })
        expect(game.hydrated.attack?.defenseLeaderIds).toEqual(['A-2'])
    })

    it('takes no pick, and so no Undo step, for the unit already struck', () => {
        const game = declaring()
        const named = tap(game, emptyBattleSelections(), 'F-inf', 'F-inf')
        const selections = {
            ...named,
            attackers: setAttackWidth(named.attackers, AttackWidth.Narrow)
        }
        expect(tap(game, selections, 'A-1')).toBe(selections)
    })
})

describe('who may counter-attack', () => {
    it('is any defender not leading, foot included, when the attack is winning', () => {
        const stage = stageOf(struck('F-inf-a'), StageKind.Counter)
        expect(stage.attackWinning).toBe(true)
        expect(stage.candidates.map((unit) => unit.id)).toEqual(['A-inf-b', 'A-cav'])
        expect(stage.pickableIds).toContain('A-inf-b')
    })

    it('leaves the foot out, though still shown, when the defence is holding', () => {
        const game = struck('F-inf-b')
        const stage = stageOf(game, StageKind.Counter)
        expect(stage.attackWinning).toBe(false)
        expect(stage.candidates.map((unit) => unit.id)).toEqual(['A-inf-b', 'A-cav'])
        expect(stage.pickableIds).not.toContain('A-inf-b')

        const tapped = stageOf(
            game,
            StageKind.Counter,
            tap(game, emptyBattleSelections(), 'A-inf-b')
        )
        expect(tapped.counterAttackers).toEqual([])
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

    it('combine two detached batteries on a wide approach, each by its own Unit Move', () => {
        const WIDE_FROM = 93
        const WIDE_INTO = 94
        const battery = (id: string): PiecePlacement => ({
            id,
            side: Side.French,
            face: artillery(),
            locale: WIDE_FROM,
            facing: WIDE_INTO
        })
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            battery('F-a1'),
            battery('F-a2'),
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(WIDE_FROM, WIDE_INTO).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        game.act(ActionType.PressAttack, french)
        const stage = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-a1', 'F-a1', 'F-a2', 'F-a2')
        )
        expect(stage.commandOptions).toEqual([CommandKind.Unit])
        expect(stage.orders).toEqual([
            { kind: CommandKind.Unit, unitIds: ['F-a1'] },
            { kind: CommandKind.Unit, unitIds: ['F-a2'] }
        ])
        expect(stage.leaders.toSorted()).toEqual(['F-a1', 'F-a2'])
        expect(stage.problem).toBeUndefined()
    })

    it('drop the command the threat was planned with once other pieces are named', () => {
        const WIDE_FROM = 93
        const WIDE_INTO = 94
        const ofLannes = (id: string, face: PiecePlacement['face']): PiecePlacement => ({
            id,
            side: Side.French,
            face,
            locale: WIDE_FROM,
            facing: WIDE_INTO,
            commanderId: 'lannes'
        })
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            ofLannes('F-a1', artillery()),
            ofLannes('F-a2', artillery()),
            ofLannes('F-inf', infantry(3)),
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(WIDE_FROM, WIDE_INTO).id,
            plan: { kind: CommandKind.Corps, unitIds: ['F-a1', 'F-a2', 'F-inf'] }
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        game.act(ActionType.PressAttack, french)

        expect(stageOf(game, StageKind.Declaration).command).toBe(CommandKind.Corps)
        const gunsOnly = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-inf', 'F-inf', 'F-a1', 'F-a2')
        )
        expect(gunsOnly.attackers.toSorted()).toEqual(['F-a1', 'F-a2'])
        expect(gunsOnly.leaders.toSorted()).toEqual(['F-a1', 'F-a2'])
        expect(gunsOnly.commandOptions).toEqual([
            CommandKind.Detach,
            CommandKind.Unit,
            CommandKind.Corps
        ])
        expect(gunsOnly.command).toBe(CommandKind.Detach)
        expect(gunsOnly.problem).toBeUndefined()
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
    function feintedAgainst(defenderIds: string[]): TestGame {
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
            unitIds: defenderIds,
            leaderIds: []
        })
        game.act(ActionType.DeclareFeint, allied, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        })
        return game
    }

    it('sends a commander forward with the last unit standing with him', () => {
        const game = feintedAgainst(['F-1', 'F-2'])
        const one = tap(game, emptyBattleSelections(), 'F-1')
        expect(stageOf(game, StageKind.Advance, one).commanders).toEqual([
            { commanderId: 'lannes', mustGo: false, goes: false }
        ])
        const both = tap(game, one, 'F-2')
        expect(stageOf(game, StageKind.Advance, both).commanders).toEqual([
            { commanderId: 'lannes', mustGo: true, goes: true }
        ])
    })

    it('names a lone defender without being asked, leaving only its commander to decide', () => {
        const game = feintedAgainst(['F-1'])
        const stage = stageOf(game, StageKind.Advance)
        expect(stage.advancing).toEqual(['F-1'])
        expect(stage.pickableIds).toEqual([])
        expect(stage.commanders).toEqual([{ commanderId: 'lannes', mustGo: false, goes: false }])
    })

    it('leaves a commander behind unless asked, and holds him back again on a second asking', () => {
        const game = feintedAgainst(['F-1', 'F-2'])
        const one = tap(game, emptyBattleSelections(), 'F-1')
        expect(commandersGoing(stageOf(game, StageKind.Advance, one))).toEqual([])

        const sending = toggleGoing(stageOf(game, StageKind.Advance, one), one, 'lannes')
        const sent = stageOf(game, StageKind.Advance, sending)
        expect(sent.commanders).toEqual([{ commanderId: 'lannes', mustGo: false, goes: true }])
        expect(commandersGoing(sent)).toEqual(['lannes'])
        expect(sent.advancing).toEqual(['F-1'])

        const holding = toggleGoing(sent, sending, 'lannes')
        expect(commandersGoing(stageOf(game, StageKind.Advance, holding))).toEqual([])
    })

    it('holds a commander back again once a unit stays with him, unless he was sent', () => {
        const game = feintedAgainst(['F-1', 'F-2'])
        const both = tap(game, tap(game, emptyBattleSelections(), 'F-1'), 'F-2')
        expect(commandersGoing(stageOf(game, StageKind.Advance, both))).toEqual(['lannes'])
        const oneAgain = tap(game, both, 'F-2')
        expect(commandersGoing(stageOf(game, StageKind.Advance, oneAgain))).toEqual([])

        const sent = toggleGoing(stageOf(game, StageKind.Advance, oneAgain), oneAgain, 'lannes')
        const bothSent = tap(game, sent, 'F-2')
        expect(
            commandersGoing(stageOf(game, StageKind.Advance, tap(game, bothSent, 'F-2')))
        ).toEqual(['lannes'])
    })
})

describe('regrouping a corps thrown back', () => {
    it('keeps its first unit with the commander until another is tapped', () => {
        const game = foughtWithoutCounterAttack('F-inf-b')
        const stage = stageOf(game, StageKind.Regroup)
        expect(keptByCommander(stage)).toEqual({ lannes: 'F-inf-a' })

        const other = stageOf(
            game,
            StageKind.Regroup,
            tap(game, emptyBattleSelections(), 'F-inf-b')
        )
        expect(keptByCommander(other)).toEqual({ lannes: 'F-inf-b' })
        expect(other.roles).toEqual({ 'F-inf-b': BattleRole.Stays })
    })
})

describe('the locales of a battle', () => {
    it('are none while no attack is on', () => {
        const game = new TestGame()
        game.deployBoth()
        expect(battleLocalesOf(game.hydrated)).toEqual([])
    })

    it('are the attack locale and the defence locale once a threat is made', () => {
        expect(battleLocalesOf(threatened().hydrated)).toEqual([ATTACK_FROM, DEFEND_IN])
    })
})

describe('the roles shown on the pieces', () => {
    const DECLARED = {
        'F-inf-a': BattleRole.Leads,
        'F-inf-b': BattleRole.Attacks,
        'A-inf-a': BattleRole.Leads,
        'A-inf-b': BattleRole.Defends,
        'A-cav': BattleRole.Defends
    }

    it('are none while no attack is on', () => {
        expect(rolesShown(undefined, undefined)).toEqual({})
    })

    it('are the declared ones for a player who is not picking', () => {
        expect(rolesShown(struck('F-inf-a').hydrated.attack, undefined)).toEqual(DECLARED)
    })

    it('add the picks of the step in front of the player', () => {
        const game = struck('F-inf-a')
        const countering = stageOf(
            game,
            StageKind.Counter,
            tap(game, emptyBattleSelections(), 'A-inf-b')
        )
        expect(rolesShown(game.hydrated.attack, countering)).toEqual({
            ...DECLARED,
            'A-inf-b': BattleRole.CounterAttacks
        })
    })

    it('give way to a retreat being arranged, which shows only a unit sent by itself', () => {
        const game = foughtWithoutCounterAttack('F-inf-a')
        const attack = game.hydrated.attack
        const stage = stageOf(game, StageKind.Retreat)
        expect(rolesShown(attack, undefined)).toMatchObject({ 'F-inf-a': BattleRole.Leads })
        expect(rolesShown(attack, stage)).toEqual({})

        const [alone] = stage.pickableIds
        const parting = stageOf(game, StageKind.Retreat, tap(game, emptyBattleSelections(), alone))
        expect(rolesShown(attack, parting)).toEqual({ [alone]: BattleRole.RetreatsAlone })
    })
})
