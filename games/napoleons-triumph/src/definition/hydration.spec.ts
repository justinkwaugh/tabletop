import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { CommandKind, DefenseAwaits } from '../model/attack.js'
import { FeintEnd } from '../model/attackDeclaration.js'
import {
    NapoleonsTriumphGameStateValidator,
    NapoleonsTriumphProjectedStateValidator,
    type NapoleonsTriumphGameState
} from '../model/gameState.js'
import {
    TestGame,
    artillery,
    cavalry,
    frenchTurn,
    guard,
    infantry,
    passTurns,
    playOut,
    type PiecePlacement,
    defendWith
} from '../testing/harness.js'
import { ActionType } from './actions.js'
import { SideSelection } from './config.js'
import { NapoleonsTriumphRuntime } from './runtime.js'
import { MachineState } from './states.js'

const FROM = 95
const INTO = 108
const REFUGE = 96

const spectator = { kind: 'spectator' } as const
type Viewer = { kind: 'player'; playerId: string } | typeof spectator

const hydrator = NapoleonsTriumphRuntime.hydrator
const approach = (from: number, to: number) => AUSTERLITZ.approachBetween(from, to).id

function viewOf(game: TestGame, viewer: Viewer) {
    return NapoleonsTriumphRuntime.visibility.state.project(game.canonical, viewer, {
        config: game.game.config
    })
}

function player(game: TestGame, side: Side): Viewer {
    return { kind: 'player', playerId: game.playerOf(side) }
}

function stored(state: NapoleonsTriumphGameState): NapoleonsTriumphGameState {
    const read: unknown = JSON.parse(JSON.stringify(state))
    if (!NapoleonsTriumphGameStateValidator.Check(read)) {
        throw new Error('The stored state is no longer a complete game state')
    }
    return read
}

function reload(game: TestGame) {
    game.state = hydrator.hydrateState(stored(game.canonical)).dehydrate()
}

function expectNothingLost(game: TestGame) {
    const canonical = game.canonical
    const rehydrated = hydrator.hydrateState(structuredClone(canonical)).dehydrate()
    expect(rehydrated).toEqual(canonical)
    expect(JSON.stringify(rehydrated)).toBe(JSON.stringify(canonical))
    expect(NapoleonsTriumphGameStateValidator.Check(rehydrated)).toBe(true)
    expect(hydrator.hydrateState(stored(canonical)).dehydrate()).toEqual(canonical)

    const players = canonical.players.map(({ playerId }): Viewer => ({ kind: 'player', playerId }))
    for (const viewer of [...players, spectator]) {
        const view = viewOf(game, viewer)
        const seenAgain = hydrator.hydrateState(structuredClone(view)).dehydrate()
        expect(seenAgain).toEqual(view)
        expect(JSON.stringify(seenAgain)).toBe(JSON.stringify(view))
        expect(NapoleonsTriumphProjectedStateValidator.Check(seenAgain)).toBe(true)
    }
}

const skirmishers: PiecePlacement[] = [
    { id: 'F-lead', side: Side.French, face: infantry(3), locale: FROM, commanderId: 'lannes' },
    { id: 'F-2', side: Side.French, face: infantry(2), locale: FROM, commanderId: 'lannes' },
    { id: 'F-guard', side: Side.French, face: guard(), locale: FROM },
    { id: 'A-1', side: Side.Allied, face: infantry(3), locale: INTO, commanderId: 'langeron' },
    { id: 'A-2', side: Side.Allied, face: infantry(2), locale: INTO, commanderId: 'langeron' },
    { id: 'A-3', side: Side.Allied, face: infantry(2), locale: INTO, commanderId: 'langeron' }
]
const lannes = { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-lead', 'F-2'] }

type Step = (game: TestGame) => unknown

const skirmish: Step[] = [
    (game) =>
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: approach(FROM, INTO),
            plan: { kind: CommandKind.Corps, unitIds: ['F-lead', 'F-2'] }
        }),
    (game) => defendWith(game, game.playerOf(Side.Allied), ['A-1', 'A-2', 'A-3']),
    (game) => game.act(ActionType.PressAttack, game.playerOf(Side.French)),
    (game) => game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: ['A-1'] }),
    (game) =>
        game.act(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: [lannes],
            wide: false,
            leaderIds: ['F-lead']
        }),
    (game) => game.act(ActionType.CounterAttack, game.playerOf(Side.Allied), { unitIds: [] }),
    (game) => game.act(ActionType.Regroup, game.playerOf(Side.French), { keep: { lannes: 'F-2' } }),
    (game) =>
        game.act(ActionType.Advance, game.playerOf(Side.Allied), {
            unitIds: ['A-2'],
            commanderIds: []
        }),
    (game) => passTurns(game, 1)
]

const opening: Step[] = [
    (game) => game.deploy(Side.Allied),
    (game) => game.deploy(Side.French),
    (game) =>
        game.act(ActionType.Move, game.playerOf(Side.Allied), {
            order: {
                kind: CommandKind.Corps,
                commanderId: 'miloradovich',
                unitIds: game.hydrated.corpsUnits('miloradovich').map((unit) => unit.id),
                road: [84]
            },
            to: { locale: 84 }
        }),
    (game) =>
        game.act(ActionType.Move, game.playerOf(Side.Allied), {
            order: {
                kind: CommandKind.Unit,
                unitIds: [game.hydrated.corpsUnits('langeron')[0].id]
            },
            to: { locale: 94 }
        }),
    (game) => passTurns(game, 1),
    (game) =>
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: approach(93, 94)
        }),
    (game) =>
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: game.hydrated.reserveUnits(94).map((unit) => unit.id)
        }),
    (game) =>
        game.act(ActionType.DeclareFeint, game.playerOf(Side.French), {
            orders: [
                {
                    kind: CommandKind.Unit,
                    unitIds: [game.hydrated.corpsUnits('st-hilaire')[0].id]
                }
            ],
            end: FeintEnd.Reserve
        }),
    (game) => passTurns(game, 2)
]

function played(game: TestGame, steps: readonly Step[], count = steps.length): TestGame {
    for (const step of steps.slice(0, count)) {
        step(game)
    }
    return game
}

function ridingOn(): TestGame {
    const game = frenchTurn([
        { id: 'F-cav', side: Side.French, face: cavalry(2), locale: 53 },
        { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: 63 }
    ])
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach: approach(53, 63) })
    game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
        losses: {},
        destinations: { 'A-screen': 72 },
        kept: {}
    })
    game.act(ActionType.Occupy, game.playerOf(Side.French), {
        orders: [{ kind: CommandKind.Unit, unitIds: ['F-cav'], road: [] }]
    })
    return game
}

function beaten(): TestGame {
    const game = frenchTurn([
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: FROM },
        { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO },
        { id: 'A-art', side: Side.Allied, face: artillery(), locale: INTO }
    ])
    const french = game.playerOf(Side.French)
    game.act(ActionType.ThreatenAttack, french, { approach: approach(FROM, INTO) })
    defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
    game.act(ActionType.PressAttack, french)
    game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
    game.act(ActionType.DeclareAttack, french, {
        orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
        wide: false,
        leaderIds: ['F-inf']
    })
    game.act(ActionType.CounterAttack, game.playerOf(Side.Allied), { unitIds: [] })
    return game
}

function givingGround(): TestGame {
    const game = frenchTurn(skirmishers)
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
        approach: approach(FROM, INTO),
        guardUnitId: 'F-guard'
    })
    game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
        losses: { 'A-3': 1 },
        destinations: { 'A-1': REFUGE, 'A-2': REFUGE, 'A-3': REFUGE },
        kept: { langeron: 'A-1' }
    })
    return game
}

function bidding(): TestGame {
    const game = new TestGame({ sideSelection: SideSelection.Auction })
    game.act(ActionType.PlaceBid, game.activePlayerId, { amount: 2 })
    return game
}

function finished(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    playOut(game)
    return game
}

const moments: [string, MachineState, () => TestGame][] = [
    ['before either army is set up', MachineState.AlliedSetup, () => new TestGame()],
    ['during a morale auction', MachineState.Bidding, bidding],
    ['between the two set-ups', MachineState.FrenchSetup, () => played(new TestGame(), opening, 1)],
    [
        'part-way through a turn of commands',
        MachineState.Commanding,
        () => played(new TestGame(), opening, 4)
    ],
    ['with a cavalry road move still in progress', MachineState.Commanding, ridingOn],
    [
        'while the defender answers a threat',
        MachineState.DefenseResponse,
        () => played(frenchTurn(skirmishers), skirmish, 1)
    ],
    [
        'while the attacker chooses between pressing and feinting',
        MachineState.FeintDecision,
        () => played(frenchTurn(skirmishers), skirmish, 2)
    ],
    [
        'while the defender names the leading units of a defence that has been pressed',
        MachineState.DefenseDeclaration,
        () => played(frenchTurn(skirmishers), skirmish, 3)
    ],
    [
        'while the attack is being declared',
        MachineState.AttackDeclaration,
        () => played(frenchTurn(skirmishers), skirmish, 4)
    ],
    [
        'while the defender weighs a counter-attack',
        MachineState.CounterAttackDecision,
        () => played(frenchTurn(skirmishers), skirmish, 5)
    ],
    [
        'while the attacker regroups and the defender has yet to advance',
        MachineState.ResolvingAttack,
        () => played(frenchTurn(skirmishers), skirmish, 6)
    ],
    ['while a beaten defender has yet to retreat', MachineState.Retreating, beaten],
    ['while the attacker follows up a retreat', MachineState.Occupying, givingGround],
    ['when the game is over', MachineState.EndOfGame, finished]
]

describe('dehydrating and hydrating the game state', () => {
    it.each(moments)('loses and changes nothing %s', (_moment, machineState, reach) => {
        const game = reach()
        expect(game.state.machineState).toBe(machineState)
        expectNothingLost(game)
    })

    it('keeps the enemy’s blocks face-down in a player’s view', () => {
        const game = played(new TestGame(), opening, 4)
        const french = game.playerOf(Side.French)
        const seen = hydrator.hydrateState(viewOf(game, player(game, Side.French))).dehydrate()
        const whole = game.hydrated
        expect(seen.units).toHaveLength(whole.units.length)
        for (const unit of seen.units) {
            const actual = whole.unit(unit.id)
            expect(unit.position).toEqual(actual.position)
            expect(unit.commanderId).toBe(actual.commanderId)
            if (unit.playerId === french) {
                expect(unit.face).toEqual(actual.face)
            } else {
                expect(unit).not.toHaveProperty('face')
            }
        }
        expect(seen).not.toHaveProperty('masterSeed')
    })

    it('keeps each player’s undeclared choices in an attack from the other', () => {
        const threatened = played(frenchTurn(skirmishers), skirmish, 1)
        const french = threatened.playerOf(Side.French)
        const again = (game: TestGame, side: Side) =>
            hydrator.hydrateState(viewOf(game, player(game, side))).dehydrate().attack
        expect(again(threatened, Side.Allied)?.attackPlan).toEqual({ playerId: french })
        expect(again(threatened, Side.French)?.attackPlan?.order).toEqual({
            kind: CommandKind.Corps,
            unitIds: ['F-lead', 'F-2']
        })

        const pressed = played(frenchTurn(skirmishers), skirmish, 3)
        for (const side of [Side.French, Side.Allied]) {
            expect(again(pressed, side)?.defenseLeaderIds).toEqual([])
            expect(again(pressed, side)?.awaits).toBe(DefenseAwaits.Leaders)
        }
    })
})

describe('playing on from a state that has been stored and hydrated again', () => {
    function replayed(start: () => TestGame, steps: readonly Step[], between: Step) {
        const game = start()
        for (const step of steps) {
            between(game)
            step(game)
        }
        between(game)
        return { ...game.canonical, id: undefined }
    }

    it.each([
        ['from set-up through a feint and its forced advance', () => new TestGame(), opening],
        [
            'through every decision of an attack that is thrown back',
            () => frenchTurn(skirmishers),
            skirmish
        ]
    ])('gives the same game %s', (_stretch, start, steps) => {
        const live = replayed(start, steps, () => undefined)
        expect(replayed(start, steps, reload)).toEqual(live)
        expect(live.machineState).toBe(MachineState.Commanding)
    })
})
