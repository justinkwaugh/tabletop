import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { ActionType, CommandKind, FeintEnd, MachineState, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    oddLossOnTheAttackers,
    type PiecePlacement,
    defendWith
} from '@tabletop/napoleons-triumph/testing'
import { advancePrompt } from '$lib/utils/advancePrompt.js'
import {
    AttackWidth,
    StageKind,
    chooseFeint,
    chooseRetreat,
    emptyBattleSelections,
    takeRetreatLosses,
    setAttackWidth,
    undoBattleSelection,
    type BattleSelections
} from './battleSelection.js'
import {
    battleLocalesOf,
    BattleRole,
    battleStageOf,
    knownToTheEnemy,
    commandersGoing,
    defendingCommanders,
    keptByCommander,
    liftRetreatingCommander,
    moveLossOnto,
    nameDefendingCommander,
    pickUnit,
    rolesShown,
    sendCommander,
    sendRetreatTo,
    type BattleStage
} from './battleStage.js'
import { RetreatRowKind, retreatRows } from './retreatPlan.js'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import { layoutPieces } from '$lib/utils/pieceLayout.js'

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
    it('takes a reserve unit from standing by to defending, and back', () => {
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
        expect(stageOf(game, StageKind.Defence, tap(game, defending, 'A-inf-a')).defenders).toEqual(
            []
        )
    })

    it('says in the rules’ words why a pick cannot be declared', () => {
        const game = threatened([
            ...PLACEMENTS,
            { id: 'A-cav-b', side: Side.Allied, face: cavalry(1), locale: DEFEND_IN }
        ])
        const twoDetached = tap(game, emptyBattleSelections(), 'A-cav', 'A-cav-b')
        expect(stageOf(game, StageKind.Defence, twoDetached).problem).toMatch(/one detached unit/)
        const sound = tap(game, emptyBattleSelections(), 'A-inf-a', 'A-cav')
        expect(stageOf(game, StageKind.Defence, sound).problem).toBeUndefined()
    })

    it('is not asked of pieces on the approach, which all defend: the attacker is asked at once', () => {
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
        expect(game.hydrated.attack?.defendingUnitIds).toEqual(['A-block'])
        expect(stageOf(game, StageKind.Feint).kind).toBe(StageKind.Feint)
    })
})

describe('naming the commanders of a defence', () => {
    it('names a commander once one of his units defends, until his flag is tapped to leave him out', () => {
        const game = threatened()
        expect(stageOf(game, StageKind.Defence).commanders).toEqual([])

        const one = tap(game, emptyBattleSelections(), 'A-inf-a')
        const named = stageOf(game, StageKind.Defence, one)
        expect(named.commanders).toEqual([
            { commanderId: 'langeron', named: true, choosable: true, namedElsewhere: false }
        ])
        expect(defendingCommanders(named)).toEqual(['langeron'])

        const leftOut = nameDefendingCommander(named, one, 'langeron', false)
        const both = tap(game, leftOut, 'A-inf-b')
        expect(defendingCommanders(stageOf(game, StageKind.Defence, both))).toEqual([])
        const back = nameDefendingCommander(
            stageOf(game, StageKind.Defence, both),
            both,
            'langeron',
            true
        )
        expect(defendingCommanders(stageOf(game, StageKind.Defence, back))).toEqual(['langeron'])
    })

    it('names the commander of a one-unit corps with his unit, with nothing to choose', () => {
        const game = threatened([
            ...PLACEMENTS,
            {
                id: 'A-solo',
                side: Side.Allied,
                face: infantry(2),
                locale: DEFEND_IN,
                commanderId: 'bagration'
            }
        ])
        const solo = tap(game, emptyBattleSelections(), 'A-solo')
        expect(stageOf(game, StageKind.Defence, solo).commanders).toEqual([
            { commanderId: 'bagration', named: true, choosable: false, namedElsewhere: false }
        ])
    })

    it('leaves out a commander named against another approach this turn, and says so', () => {
        const game = threatened()
        game.arrange((state) => {
            state.commander('langeron').defendedApproach = state.map.approachBetween(
                DEFEND_IN,
                96
            ).id
        })
        const stage = stageOf(
            game,
            StageKind.Defence,
            tap(game, emptyBattleSelections(), 'A-inf-a')
        )
        expect(stage.commanders).toEqual([
            { commanderId: 'langeron', named: false, choosable: false, namedElsewhere: true }
        ])
        expect(stage.problem).toBeUndefined()
    })
})

describe('a defence by pieces on the approach that was still waiting to be named', () => {
    it('is named for the defender, who can only confirm it, as it was before the game named it itself', () => {
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
        const allied = game.playerOf(Side.Allied)
        game.arrange((state) => {
            const attack = state.attack
            if (attack) {
                attack.defendingUnitIds = []
                attack.defendingCommanderIds = []
                attack.defendersBlocking = undefined
                attack.awaits = undefined
            }
            state.unit('A-block').defendedApproach = undefined
            state.machineState = MachineState.DefenseResponse
            state.activePlayerIds = [allied]
        })
        const stage = stageOf(game, StageKind.Defence)
        expect(stage).toMatchObject({ forced: true, defenders: ['A-block'], pickableIds: [] })
        expect(stage.problem).toBeUndefined()

        game.act(ActionType.DeclareDefense, allied, { unitIds: stage.defenders })
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
    })
})

describe('naming the leading units of a defence that has been pressed', () => {
    function pressed(placements: readonly PiecePlacement[] = PLACEMENTS, defenders = ALL) {
        const game = threatened(placements)
        defendWith(game, game.playerOf(Side.Allied), defenders)
        game.act(ActionType.PressAttack, game.playerOf(Side.French))
        return game
    }
    const ALL = ['A-inf-a', 'A-inf-b', 'A-cav']

    it('offers the defending pieces, each a defender until it is tapped to lead and again to stand back', () => {
        const game = pressed()
        const stage = stageOf(game, StageKind.DefenceLeaders)
        expect(stage.pickableIds).toEqual(ALL)
        expect(stage.leaders).toEqual([])
        expect(stage.problem).toBeUndefined()

        const leading = tap(game, emptyBattleSelections(), 'A-inf-a')
        expect(stageOf(game, StageKind.DefenceLeaders, leading).roles).toEqual({
            'A-inf-a': BattleRole.Leads,
            'A-inf-b': BattleRole.Defends,
            'A-cav': BattleRole.Defends
        })
        expect(
            stageOf(game, StageKind.DefenceLeaders, tap(game, leading, 'A-inf-a')).leaders
        ).toEqual([])
    })

    it('keeps no more leading units than the approach is wide', () => {
        const game = pressed()
        const wide = game.hydrated.map.approachBetween(DEFEND_IN, ATTACK_FROM).wide
        const all = tap(game, emptyBattleSelections(), 'A-inf-a', 'A-inf-b', 'A-cav')
        expect(stageOf(game, StageKind.DefenceLeaders, all).leaders).toEqual(
            wide ? ['A-inf-b', 'A-cav'] : ['A-cav']
        )
    })

    it('says in the rules’ words why a unit cannot lead', () => {
        const weak = { id: 'A-cav-b', side: Side.Allied, face: cavalry(1), locale: DEFEND_IN }
        const game = pressed(
            [...PLACEMENTS.filter((piece) => piece.id !== 'A-cav'), weak],
            ['A-inf-a', 'A-cav-b']
        )
        const weakLeader = tap(game, emptyBattleSelections(), 'A-cav-b')
        expect(stageOf(game, StageKind.DefenceLeaders, weakLeader).problem).toMatch(/one-strength/)
        const sound = tap(game, emptyBattleSelections(), 'A-inf-a')
        expect(stageOf(game, StageKind.DefenceLeaders, sound).problem).toBeUndefined()
    })
})

describe('arranging a retreat', () => {
    function retreating(placements: readonly PiecePlacement[]) {
        const game = threatened(placements)
        const empty = emptyBattleSelections()
        const choosingLosses = { ...empty, defence: chooseRetreat(empty.defence) }
        return { game, choosingLosses, selections: takeRetreatLosses(choosingLosses) }
    }

    it('settles how the losses fall first, when they can fall more than one way', () => {
        const { game, choosingLosses, selections } = retreating(PLACEMENTS)
        const first = stageOf(game, StageKind.Retreat, choosingLosses)
        expect(first.choosingLosses).toBe(true)
        expect(first.pickableIds).toEqual([])
        expect(stageOf(game, StageKind.Retreat, selections).choosingLosses).toBe(false)

        const back = undoBattleSelection(selections, StageKind.Retreat)
        expect(stageOf(game, StageKind.Retreat, back).choosingLosses).toBe(true)
    })

    it('asks nothing about the losses when they can fall only one way', () => {
        const oneInfantry = PLACEMENTS.filter((piece) => piece.id !== 'A-inf-b')
        const { game, choosingLosses } = retreating(oneInfantry)
        const stage = stageOf(game, StageKind.Retreat, choosingLosses)
        expect(stage.plan.groups).toHaveLength(1)
        expect(stage.choosingLosses).toBe(false)
    })

    it('keeps the units together until the player parts them', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.plan.room.size).toBeGreaterThan(1)
        expect(new Set(Object.values(stage.plan.destinations)).size).toBe(1)
        expect(retreatRows(stage.plan)).toEqual([
            expect.objectContaining({
                kind: RetreatRowKind.Retreats,
                locale: stage.plan.destinations['A-cav']
            })
        ])
    })

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

    it('moves a step of the loss onto a tapped unit from another of its group, never changing how many are lost', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const lossesAfter = (...taps: string[]) => {
            let current = selections
            for (const unitId of taps) {
                current = moveLossOnto(
                    game.hydrated,
                    stageOf(game, StageKind.Retreat, current),
                    current,
                    unitId
                )
            }
            return stageOf(game, StageKind.Retreat, current).plan
        }
        const suggested = lossesAfter()
        const [group] = suggested.groups
        expect(group.unitIds.toSorted()).toEqual(['A-inf-a', 'A-inf-b'])
        expect(group.assigned).toBe(group.steps)
        const total = (plan: typeof suggested) =>
            Object.values(plan.losses).reduce((sum, steps) => sum + steps, 0)

        const before = suggested.losses['A-inf-b'] ?? 0
        const moved = lossesAfter('A-inf-b')
        expect(moved.losses['A-inf-b'] ?? 0).toBe(Math.min(2, before + 1, group.steps))
        expect(total(moved)).toBe(total(suggested))
        expect(moved.lossesValid).toBe(true)

        const hammered = lossesAfter('A-inf-b', 'A-inf-b', 'A-inf-b', 'A-inf-b', 'A-inf-b')
        expect(hammered.losses['A-inf-b']).toBe(Math.min(2, group.steps))
        expect(total(hammered)).toBe(total(suggested))
        expect(hammered.lossesValid).toBe(true)
    })

    it('leaves a unit that owes no loss in the retreat without one, however often it is tapped', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.plan.groups.flatMap((group) => group.unitIds)).not.toContain('A-cav')
        expect(moveLossOnto(game.hydrated, stage, selections, 'A-cav')).toBe(selections)
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

    it('keeps the unit tapped with its commander once his flag is picked up', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.plan.kept).toEqual({ langeron: 'A-inf-a' })
        expect(stage.plan.commanders).toEqual([
            {
                commanderId: 'langeron',
                unitId: 'A-inf-a',
                corpsUnitIds: ['A-inf-a', 'A-inf-b'],
                movable: true
            }
        ])

        const lifted = liftRetreatingCommander(stage, selections, 'langeron')
        const choosing = stageOf(game, StageKind.Retreat, lifted)
        expect(choosing.movingCommander).toBe('langeron')
        expect(choosing.pickableIds.toSorted()).toEqual(['A-inf-a', 'A-inf-b'])

        const kept = stageOf(game, StageKind.Retreat, tap(game, lifted, 'A-inf-b'))
        expect(kept.plan.kept).toEqual({ langeron: 'A-inf-b' })
        expect(kept.movingCommander).toBeUndefined()
    })

    it('puts a commander’s flag back when it is tapped again, or when Undo is pressed', () => {
        const { game, selections } = retreating(PLACEMENTS)
        const stage = stageOf(game, StageKind.Retreat, selections)
        const lifted = liftRetreatingCommander(stage, selections, 'langeron')
        const again = liftRetreatingCommander(
            stageOf(game, StageKind.Retreat, lifted),
            lifted,
            'langeron'
        )
        expect(stageOf(game, StageKind.Retreat, again).movingCommander).toBeUndefined()
        const undone = undoBattleSelection(lifted, StageKind.Retreat)
        expect(stageOf(game, StageKind.Retreat, undone).movingCommander).toBeUndefined()
        expect(stageOf(game, StageKind.Retreat, undone).choosingLosses).toBe(false)
    })

    it('gives a commander with one unit left no choice of whom he stays with', () => {
        const oneInfantry = PLACEMENTS.filter((piece) => piece.id !== 'A-inf-b')
        const { game, selections } = retreating(oneInfantry)
        const stage = stageOf(game, StageKind.Retreat, selections)
        expect(stage.plan.commanders).toEqual([
            {
                commanderId: 'langeron',
                unitId: 'A-inf-a',
                corpsUnitIds: ['A-inf-a'],
                movable: false
            }
        ])
        expect(() => liftRetreatingCommander(stage, selections, 'langeron')).toThrow()
    })
})

function standing(plan?: typeof WITH_LANNES): TestGame {
    const game = threatened(PLACEMENTS, plan)
    defendWith(game, game.playerOf(Side.Allied), ['A-inf-a'])
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
        expect(stage.pressShowsLeaders).toBe(false)
    })

    it('says that pressing shows the leading units when the defence named them with its pieces', () => {
        const game = standing(WITH_LANNES)
        game.arrange((state) => {
            const attack = state.attack
            if (attack) {
                attack.awaits = undefined
                attack.defensePlan = { playerId: attack.defenderId, leaderIds: [] }
            }
        })
        expect(stageOf(game, StageKind.Feint).pressShowsLeaders).toBe(true)
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
        planned.act(ActionType.LeadDefense, planned.playerOf(Side.Allied), {
            leaderIds: ['A-inf-a']
        })
        const stage = stageOf(planned, StageKind.Declaration)
        expect(stage.startsFromThreat).toBe(true)
        expect(stage.attackers).toEqual(['F-inf-a', 'F-inf-b'])
        expect(stage.command).toBe(CommandKind.Corps)

        const unplanned = standing()
        unplanned.act(ActionType.PressAttack, unplanned.playerOf(Side.French))
        unplanned.act(ActionType.LeadDefense, unplanned.playerOf(Side.Allied), {
            leaderIds: ['A-inf-a']
        })
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
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
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
    defendWith(game, game.playerOf(Side.Allied), ['A-inf-a', 'A-inf-b', 'A-cav'])
    game.act(ActionType.PressAttack, french)
    game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: ['A-inf-a'] })
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
        defendWith(game, game.playerOf(Side.Allied), ['A-1', 'A-2'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: ['A-1', 'A-2'] })
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
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.PressAttack, game.playerOf(Side.French))
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
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

    it('combine two detached batteries on a wide approach, each by its own Unit Move, both leading as they must', () => {
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
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
        const stage = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-a1', 'F-a2')
        )
        expect(stage.commandOptions).toEqual([CommandKind.Unit])
        expect(stage.orders).toEqual([
            { kind: CommandKind.Unit, unitIds: ['F-a1'] },
            { kind: CommandKind.Unit, unitIds: ['F-a2'] }
        ])
        expect(stage.firesAsAPair).toBe(true)
        expect(stage.wide).toBe(true)
        expect(stage.leaders.toSorted()).toEqual(['F-a1', 'F-a2'])
        expect(stage.problem).toBeUndefined()

        const narrowed = stageOf(game, StageKind.Declaration, {
            ...tap(game, emptyBattleSelections(), 'F-a1', 'F-a2'),
            attackers: setAttackWidth(
                tap(game, emptyBattleSelections(), 'F-a1', 'F-a2').attackers,
                AttackWidth.Narrow
            )
        })
        expect(narrowed.wide).toBe(true)

        const alone = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-a1', 'F-a2', 'F-a2')
        )
        expect(alone.attackers).toEqual(['F-a1'])
        expect(alone.firesAsAPair).toBe(false)
    })

    it('are given no command together across a narrow approach, where only one may lead', () => {
        const NARROW_FROM = 72
        const NARROW_INTO = 74
        const battery = (id: string): PiecePlacement => ({
            id,
            side: Side.French,
            face: artillery(),
            locale: NARROW_FROM,
            facing: NARROW_INTO
        })
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            battery('F-a1'),
            battery('F-a2'),
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: NARROW_INTO }
        ])
        const french = game.playerOf(Side.French)
        const across = game.hydrated.map.approachBetween(NARROW_FROM, NARROW_INTO)
        expect(across.wide).toBe(false)
        game.act(ActionType.ThreatenAttack, french, { approach: across.id })
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
        const both = stageOf(
            game,
            StageKind.Declaration,
            tap(game, emptyBattleSelections(), 'F-a1', 'F-a2')
        )
        expect(both.commandOptions).toEqual([])
        expect(both.orders).toBeUndefined()
        expect(both.problem).toBe('No one command can send these units into the attack together')
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
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.PressAttack, french)

        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
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
    function feintedAgainst(defenderIds: string[], commanderIds?: string[]): TestGame {
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
        if (commanderIds) {
            game.act(ActionType.DeclareDefense, game.playerOf(Side.French), {
                unitIds: defenderIds,
                commanderIds
            })
        } else {
            defendWith(game, game.playerOf(Side.French), defenderIds)
        }
        game.act(ActionType.DeclareFeint, allied, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        })
        return game
    }

    it('keeps a commander who was not named with the units that stay, offering him only with the last of them', () => {
        const game = feintedAgainst(['F-1', 'F-2'], [])
        const one = tap(game, emptyBattleSelections(), 'F-2')
        expect(stageOf(game, StageKind.Advance, one).commanders).toEqual([
            { commanderId: 'lannes', unitsStaying: 1, mustGo: false, goes: false, named: false }
        ])
        expect(advancePrompt(stageOf(game, StageKind.Advance, one))).toBe(
            'At least one defending unit steps up to block the approach. Units going without their commander are detached from their corps. Lannes was not named to defend, so he stays in reserve.'
        )
        const asked = sendCommander(stageOf(game, StageKind.Advance, one), one, 'lannes', true)
        expect(commandersGoing(stageOf(game, StageKind.Advance, asked))).toEqual([])
        expect(stageOf(game, StageKind.Advance).commanders).toEqual([
            { commanderId: 'lannes', unitsStaying: 0, mustGo: true, goes: true, named: false }
        ])
    })

    it('sends every defender forward, and their commander with them, until one is held back', () => {
        const game = feintedAgainst(['F-1', 'F-2'])
        const all = stageOf(game, StageKind.Advance)
        expect(all.advancing).toEqual(['F-1', 'F-2'])
        expect(all.commanders).toEqual([
            { commanderId: 'lannes', unitsStaying: 0, mustGo: true, goes: true, named: true }
        ])
        const one = tap(game, emptyBattleSelections(), 'F-2')
        expect(stageOf(game, StageKind.Advance, one).advancing).toEqual(['F-1'])
        expect(stageOf(game, StageKind.Advance, one).commanders).toEqual([
            { commanderId: 'lannes', unitsStaying: 1, mustGo: false, goes: false, named: true }
        ])
        const both = tap(game, one, 'F-2')
        expect(stageOf(game, StageKind.Advance, both).commanders).toEqual([
            { commanderId: 'lannes', unitsStaying: 0, mustGo: true, goes: true, named: true }
        ])
    })

    it('names a lone defender without being asked, leaving only its commander to decide', () => {
        const game = feintedAgainst(['F-1'])
        const stage = stageOf(game, StageKind.Advance)
        expect(stage.advancing).toEqual(['F-1'])
        expect(stage.pickableIds).toEqual([])
        expect(stage.commanders).toEqual([
            { commanderId: 'lannes', unitsStaying: 1, mustGo: false, goes: false, named: true }
        ])
    })

    it('leaves a commander behind unless asked, and holds him back again on a second asking', () => {
        const game = feintedAgainst(['F-1', 'F-2'])
        const one = tap(game, emptyBattleSelections(), 'F-2')
        expect(commandersGoing(stageOf(game, StageKind.Advance, one))).toEqual([])

        const sending = sendCommander(stageOf(game, StageKind.Advance, one), one, 'lannes', true)
        const sent = stageOf(game, StageKind.Advance, sending)
        expect(sent.commanders).toEqual([
            { commanderId: 'lannes', unitsStaying: 1, mustGo: false, goes: true, named: true }
        ])
        expect(commandersGoing(sent)).toEqual(['lannes'])
        expect(sent.advancing).toEqual(['F-1'])

        const holding = sendCommander(sent, sending, 'lannes', false)
        expect(commandersGoing(stageOf(game, StageKind.Advance, holding))).toEqual([])
    })

    it('says what the advance does to the corps as the choices stand', () => {
        const lone = feintedAgainst(['F-1'])
        const alone = stageOf(lone, StageKind.Advance)
        expect(advancePrompt(alone)).toBe(
            'The defending unit steps up to block the approach. Going alone, it is detached from its corps.'
        )
        const joined = sendCommander(alone, emptyBattleSelections(), 'lannes', true)
        expect(advancePrompt(stageOf(lone, StageKind.Advance, joined))).toBe(
            'The defending unit steps up to block the approach, joined by Lannes. The remaining unit detaches and remains in reserve.'
        )

        const two = feintedAgainst(['F-1', 'F-2'])
        expect(advancePrompt(stageOf(two, StageKind.Advance))).toBe(
            'At least one defending unit steps up to block the approach, joined by Lannes.'
        )
        const one = tap(two, emptyBattleSelections(), 'F-2')
        expect(advancePrompt(stageOf(two, StageKind.Advance, one))).toBe(
            'At least one defending unit steps up to block the approach. Units going without their commander are detached from their corps.'
        )
        const both = tap(two, one, 'F-2')
        expect(advancePrompt(stageOf(two, StageKind.Advance, both))).toBe(
            'At least one defending unit steps up to block the approach, joined by Lannes.'
        )
    })

    it('holds a commander back again once a unit stays with him, unless he was sent', () => {
        const game = feintedAgainst(['F-1', 'F-2'])
        const both = emptyBattleSelections()
        expect(commandersGoing(stageOf(game, StageKind.Advance, both))).toEqual(['lannes'])
        const oneAgain = tap(game, both, 'F-2')
        expect(commandersGoing(stageOf(game, StageKind.Advance, oneAgain))).toEqual([])

        const sent = sendCommander(
            stageOf(game, StageKind.Advance, oneAgain),
            oneAgain,
            'lannes',
            true
        )
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
        expect(other.roles).toEqual({})
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

describe('after an attack, the units the enemy knows of', () => {
    function blockingStack(
        mark: (unit: { shown?: unknown; defendedApproach?: number }, approach: number) => void
    ) {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(
            game,
            Array.from({ length: 5 }, (_, index) => ({
                id: `inf-${index}`,
                side: Side.Allied,
                face: infantry(2),
                locale: 94,
                facing: 93,
                commanderId: 'langeron'
            }))
        )
        const approach = game.hydrated.map.approachBetween(94, 93).id
        game.arrange((state) => mark(state.unit('inf-3'), approach))
        const state = game.hydrated
        const [stack] = layoutPieces(state, {
            rotation: 0,
            readBy: game.playerOf(Side.French),
            singledOut: knownToTheEnemy(state.units)
        }).filter((sprite) => sprite.group.commander?.id === 'langeron')
        const bar = APPROACH_GEOMETRY[approach].centre
        return stack.blocks
            .toSorted(
                (a, b) =>
                    Math.hypot(a.centre.x - bar.x, a.centre.y - bar.y) -
                    Math.hypot(b.centre.x - bar.x, b.centre.y - bar.y)
            )
            .map((block) => block.unit.id)
    }

    it('stand at the front of their stack for the other player, whichever block they are', () => {
        expect(blockingStack(() => {})[0]).toBe('inf-0')
        const seen = blockingStack((unit) => {
            unit.shown = infantry(2)
        })
        expect(seen[0]).toBe('inf-3')
        const defended = blockingStack((unit, approach) => {
            unit.defendedApproach = approach
        })
        expect(defended[0]).toBe('inf-3')
    })
})

describe('choosing where an odd step falls', () => {
    it('names the units it falls between as leading units', () => {
        const game = oddLossOnTheAttackers()
        expect(stageOf(game, StageKind.OddLoss).takers).toBe('leading')
    })

    it('names them as counter-attacking units when the step falls between counter-attackers', () => {
        const game = oddLossOnTheAttackers()
        const attack = game.hydrated.attack
        assertExists(attack, 'The attack waits on the odd loss')
        attack.counterAttackingUnitIds = ['F01', 'F02']
        const stage = battleStageOf(game.hydrated, attack, emptyBattleSelections())
        assertExists(stage, 'The defender chooses where the odd step falls')
        expect(stage.kind === StageKind.OddLoss && stage.takers).toBe('counter-attacking')
    })
})
