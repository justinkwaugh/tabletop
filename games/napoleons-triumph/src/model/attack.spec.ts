import { describe, expect, it } from 'vitest'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement
} from '../testing/harness.js'
import { CommandKind } from './attack.js'
import { nextDecision } from './attackDecisions.js'
import { FeintEnd } from './attackDeclaration.js'

const ATTACK_FROM = 95
const DEFEND_IN = 108

function frenchTurn(placements: readonly PiecePlacement[]): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    return game
}

function threaten(game: TestGame) {
    const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach })
}

describe('rule 11 attack example 3: artillery against artillery', () => {
    const placements: PiecePlacement[] = [
        {
            id: 'F-art',
            side: Side.French,
            face: artillery(),
            locale: ATTACK_FROM,
            facing: DEFEND_IN
        },
        {
            id: 'A-art',
            side: Side.Allied,
            face: artillery(),
            locale: DEFEND_IN,
            facing: ATTACK_FROM
        },
        {
            id: 'A-inf',
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            facing: ATTACK_FROM
        }
    ]

    it('costs the defender one step of its choice and moves nobody', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        expect(game.state.machineState).toBe(MachineState.DefenseResponse)
        expect(() =>
            game.act(ActionType.Retreat, allied, { losses: {}, destinations: {}, kept: {} })
        ).toThrow()
        game.act(ActionType.DeclareDefense, allied, {
            unitIds: ['A-art', 'A-inf'],
            leaderIds: ['A-art']
        })
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
        game.act(ActionType.PressAttack, french)
        expect(game.hydrated.unit('A-art').shown).toEqual(artillery())
        const declared = game.outcome(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-art'] }],
            wide: false,
            leaderIds: ['F-art']
        })
        expect(declared).toMatchObject({ initialResult: 1, finalResult: 1, attackerWon: true })
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(game.activePlayerId).toBe(allied)
        game.act(ActionType.AssignLosses, allied, { allocation: { 'A-inf': 1 } })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.findUnit('A-inf')?.face).toEqual(infantry(1))
        expect(state.unit('A-art').position?.locale).toBe(DEFEND_IN)
        expect(state.unit('F-art').position?.locale).toBe(ATTACK_FROM)
        expect(state.playerOf(Side.Allied).morale).toBe(26)
        expect(state.playerOf(Side.French).morale).toBe(23)
    })
})

describe('rule 11 attack example 4: infantry repulsed by a cavalry counter-attack', () => {
    const placements: PiecePlacement[] = [
        {
            id: 'F-block',
            side: Side.French,
            face: infantry(2),
            locale: ATTACK_FROM,
            facing: DEFEND_IN
        },
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
        {
            id: 'A-inf',
            side: Side.Allied,
            face: infantry(1),
            locale: DEFEND_IN,
            facing: ATTACK_FROM
        },
        { id: 'A-cav', side: Side.Allied, face: cavalry(3), locale: DEFEND_IN, facing: ATTACK_FROM }
    ]

    it('follows the worked example to a final result of -1', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        game.act(ActionType.DeclareDefense, allied, {
            unitIds: ['A-inf', 'A-cav'],
            leaderIds: ['A-inf']
        })
        game.act(ActionType.PressAttack, french)
        const declared = game.outcome(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf']
        })
        expect(declared).toMatchObject({ initialResult: 1 })
        expect(game.state.machineState).toBe(MachineState.CounterAttackDecision)
        const countered = game.outcome(ActionType.CounterAttack, allied, { unitIds: ['A-cav'] })
        expect(countered).toMatchObject({ finalResult: -1, attackerWon: false, moraleLost: 2 })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-inf').face).toEqual(infantry(1))
        expect(state.unit('F-inf').position).toEqual({ locale: ATTACK_FROM })
        expect(state.findUnit('A-inf')).toBeUndefined()
        expect(state.unit('A-cav').face).toEqual(cavalry(2))
        expect(state.playerOf(Side.French).morale).toBe(21)
        expect(state.playerOf(Side.Allied).morale).toBe(25)
        expect(state.playerOf(Side.Allied).heavyCavalryCommitted).toBe(true)
    })
})

describe('feints', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-inf', side: Side.French, face: infantry(2), locale: ATTACK_FROM },
        {
            id: 'A-one',
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        },
        {
            id: 'A-two',
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        }
    ]

    it('draws a reserve defender up to the approach and closes the approach for the turn', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        game.act(ActionType.DeclareDefense, allied, { unitIds: ['A-one', 'A-two'], leaderIds: [] })
        game.act(ActionType.DeclareFeint, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            end: FeintEnd.Approach
        })
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(game.activePlayerId).toBe(allied)
        game.act(ActionType.Advance, allied, { unitIds: ['A-one'], commanderIds: [] })
        const state = game.hydrated
        const defenseApproach = state.map.approachBetween(DEFEND_IN, ATTACK_FROM).id
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('A-one').position).toEqual({
            locale: DEFEND_IN,
            approach: defenseApproach
        })
        expect(state.unit('A-one').commanderId).toBeUndefined()
        expect(state.unit('A-two').commanderId).toBe('langeron')
        expect(state.unit('F-inf').position?.approach).toBe(
            state.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
        )
        expect(() => threaten(game)).toThrow()
    })
})

describe('retreats', () => {
    it('lets a reserve defender give ground before combat, at a cost to its idle infantry', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
            {
                id: 'A-inf',
                side: Side.Allied,
                face: infantry(2),
                locale: DEFEND_IN,
                commanderId: 'langeron'
            },
            {
                id: 'A-cav',
                side: Side.Allied,
                face: cavalry(2),
                locale: DEFEND_IN,
                commanderId: 'langeron'
            }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        expect(() =>
            game.act(ActionType.Retreat, allied, {
                losses: {},
                destinations: { 'A-inf': 96, 'A-cav': 96 },
                kept: { langeron: 'A-inf' }
            })
        ).toThrow()
        game.act(ActionType.Retreat, allied, {
            losses: { 'A-inf': 1 },
            destinations: { 'A-inf': 96, 'A-cav': 96 },
            kept: { langeron: 'A-cav' }
        })
        expect(game.state.machineState).toBe(MachineState.Occupying)
        game.act(ActionType.Occupy, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }]
        })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-inf').position).toEqual({ locale: DEFEND_IN })
        expect(state.unit('A-inf').face).toEqual(infantry(1))
        expect(state.unit('A-inf').commanderId).toBeUndefined()
        expect(state.commander('langeron').position).toEqual({ locale: 96 })
        expect(state.playerOf(Side.Allied).morale).toBe(26)
    })

    it('throws a beaten defender out of the locale and brings the attackers in', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: DEFEND_IN },
            { id: 'A-art', side: Side.Allied, face: artillery(), locale: DEFEND_IN }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        game.act(ActionType.DeclareDefense, allied, { unitIds: ['A-inf'], leaderIds: ['A-inf'] })
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf']
        })
        expect(game.state.machineState).toBe(MachineState.Retreating)
        game.act(ActionType.Retreat, allied, { losses: {}, destinations: {}, kept: {} })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-inf').position).toEqual({ locale: DEFEND_IN })
        expect(state.unit('F-inf').face).toEqual(infantry(2))
        expect(state.findUnit('A-art')).toBeUndefined()
        expect(state.findUnit('A-inf')).toBeUndefined()
        expect(state.playerOf(Side.Allied).morale).toBe(24)
        expect(state.limits.stormedLocales).toEqual([DEFEND_IN])
    })
})

describe('errata and designer rulings', () => {
    const WIDE_FROM = 93
    const WIDE_INTO = 94

    it('lets two batteries combine their Unit Moves only to lead the attack together', () => {
        const pair = [
            { kind: CommandKind.Unit, unitIds: ['F-art-a'] },
            { kind: CommandKind.Unit, unitIds: ['F-art-b'] }
        ]
        const game = frenchTurn([
            {
                id: 'F-art-a',
                side: Side.French,
                face: artillery(),
                locale: WIDE_FROM,
                facing: WIDE_INTO
            },
            {
                id: 'F-art-b',
                side: Side.French,
                face: artillery(),
                locale: WIDE_FROM,
                facing: WIDE_INTO
            },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        const french = game.playerOf(Side.French)
        const approach = game.hydrated.map.approachBetween(WIDE_FROM, WIDE_INTO).id
        game.act(ActionType.ThreatenAttack, french, { approach })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        expect(() =>
            game.act(ActionType.DeclareFeint, french, { orders: pair, end: FeintEnd.Approach })
        ).toThrow(/lead an attack together/)
        game.act(ActionType.PressAttack, french)
        expect(() =>
            game.act(ActionType.DeclareAttack, french, {
                orders: pair,
                wide: true,
                leaderIds: ['F-art-a']
            })
        ).toThrow(/lead an attack together/)
        const declared = game.outcome(ActionType.DeclareAttack, french, {
            orders: pair,
            wide: true,
            leaderIds: ['F-art-a', 'F-art-b']
        })
        expect(declared).toMatchObject({ initialResult: 2, attackerWon: true })
    })

    it('never sends the fixed battery forward after a feint', () => {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(game, [
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: WIDE_INTO },
            { id: 'F-fixed', side: Side.French, face: artillery(), locale: WIDE_FROM },
            {
                id: 'F-inf',
                side: Side.French,
                face: infantry(2),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            }
        ])
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
        })
        const allied = game.playerOf(Side.Allied)
        const french = game.playerOf(Side.French)
        const approach = game.hydrated.map.approachBetween(WIDE_INTO, WIDE_FROM).id
        const feint = {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        }

        game.act(ActionType.ThreatenAttack, allied, { approach })
        game.act(ActionType.DeclareDefense, french, {
            unitIds: ['F-fixed', 'F-inf'],
            leaderIds: []
        })
        game.act(ActionType.DeclareFeint, allied, feint)
        expect(nextDecision(game.hydrated)).toMatchObject({ playerId: french, unitIds: ['F-inf'] })
        expect(() =>
            game.act(ActionType.Advance, french, { unitIds: ['F-fixed'], commanderIds: [] })
        ).toThrow()
    })

    it('asks for no advance when only the fixed battery was named', () => {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(game, [
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: WIDE_INTO },
            { id: 'F-fixed', side: Side.French, face: artillery(), locale: WIDE_FROM }
        ])
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
        })
        const allied = game.playerOf(Side.Allied)
        const approach = game.hydrated.map.approachBetween(WIDE_INTO, WIDE_FROM).id
        game.act(ActionType.ThreatenAttack, allied, { approach })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.French), {
            unitIds: ['F-fixed'],
            leaderIds: []
        })
        game.act(ActionType.DeclareFeint, allied, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        })
        expect(game.state.machineState).toBe(MachineState.Commanding)
        expect(game.activePlayerId).toBe(allied)
    })
})

describe('Guard infantry beside line infantry', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: 93, commanderId: 'lannes' },
        { id: 'F-inf-b', side: Side.French, face: infantry(3), locale: 93, commanderId: 'lannes' },
        {
            id: 'A-guard',
            side: Side.Allied,
            face: { ...infantry(3), guard: true },
            locale: 94,
            commanderId: 'constantine'
        },
        {
            id: 'A-line',
            side: Side.Allied,
            face: infantry(2),
            locale: 94,
            commanderId: 'constantine'
        }
    ]

    it('leads a defence from reserve with it, but does not counter-attack with it', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const approach = game.hydrated.map.approachBetween(93, 94).id
        game.act(ActionType.ThreatenAttack, french, { approach })
        game.act(ActionType.DeclareDefense, allied, {
            unitIds: ['A-guard', 'A-line'],
            leaderIds: ['A-guard', 'A-line']
        })
        expect(game.state.machineState).toBe(MachineState.FeintDecision)

        const second = frenchTurn(placements)
        second.act(ActionType.ThreatenAttack, second.playerOf(Side.French), { approach })
        second.act(ActionType.DeclareDefense, second.playerOf(Side.Allied), {
            unitIds: ['A-guard', 'A-line'],
            leaderIds: []
        })
        second.act(ActionType.PressAttack, second.playerOf(Side.French))
        second.act(ActionType.DeclareAttack, second.playerOf(Side.French), {
            orders: [
                { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-inf', 'F-inf-b'] }
            ],
            wide: true,
            leaderIds: ['F-inf']
        })
        expect(second.state.machineState).toBe(MachineState.CounterAttackDecision)
        expect(() =>
            second.act(ActionType.CounterAttack, second.playerOf(Side.Allied), {
                unitIds: ['A-guard', 'A-line']
            })
        ).toThrow(/Guard infantry cannot be paired/)
    })
})
