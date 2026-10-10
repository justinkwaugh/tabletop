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
import { FeintEnd } from './attackDeclaration.js'

const WEST = 52
const NEAR = 53
const TAKEN = 63
const BEYOND = 64
const ASIDE = 62

function frenchTurn(placements: readonly PiecePlacement[]): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    return game
}

function approach(game: TestGame, from: number, to: number): number {
    return game.hydrated.map.approachBetween(from, to).id
}

const rider = { kind: CommandKind.Unit, unitIds: ['F-cav'] }
const ridingOn = { ...rider, road: [], continues: true as const }

describe('cavalry attacking by road from the attack locale', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-cav', side: Side.French, face: cavalry(2), locale: NEAR },
        { id: 'F-inf', side: Side.French, face: infantry(2), locale: WEST },
        { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: TAKEN },
        { id: 'A-line', side: Side.Allied, face: infantry(2), locale: BEYOND }
    ]

    function taken(byRoad: boolean): TestGame {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, NEAR, TAKEN) })
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-screen': 72 },
            kept: {}
        })
        game.act(ActionType.Occupy, french, { orders: [byRoad ? { ...rider, road: [] } : rider] })
        return game
    }

    it('may ride on after the defender gives way, unseen until its move is over', () => {
        const state = taken(true).hydrated
        expect(state.unit('F-cav').position).toEqual({ locale: TAKEN })
        expect(state.roadMarch).toMatchObject({ unitIds: ['F-cav'], start: NEAR, path: [TAKEN] })
        expect(state.unit('F-cav').shown).toBeUndefined()
        expect(state.machineState).toBe(MachineState.Commanding)
    })

    it('has made an ordinary move, with nothing more to come, when it did not take the road', () => {
        const game = taken(false)
        expect(game.hydrated.roadMarch).toBeUndefined()
        expect(() =>
            game.act(ActionType.Move, game.playerOf(Side.French), {
                order: { ...rider, road: [BEYOND], continues: true },
                to: { locale: BEYOND }
            })
        ).toThrow(/No road move/)
    })

    it('threatens again at no further cost and must feint if the next defender stands', () => {
        const game = taken(true)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, TAKEN, BEYOND) })
        game.act(ActionType.DeclareDefense, allied, { unitIds: ['A-line'], leaderIds: [] })
        expect(() =>
            game.act(ActionType.DeclareFeint, french, { orders: [rider], end: FeintEnd.Approach })
        ).toThrow()
        game.act(ActionType.DeclareFeint, french, { orders: [ridingOn], end: FeintEnd.Approach })
        const state = game.hydrated
        expect(state.unit('F-cav').position).toEqual({
            locale: TAKEN,
            approach: approach(game, TAKEN, BEYOND)
        })
        expect(state.unit('F-cav').shown).toEqual(cavalry(2))
        expect(state.roadMarch).toBeUndefined()
        expect(state.getPlayerState(french).independentCommandsUsed).toBe(1)
        expect(state.machineState).toBe(MachineState.ResolvingAttack)
    })

    it('takes a second locale when that defender gives way too, and stops when the road runs out', () => {
        const game = taken(true)
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, TAKEN, BEYOND) })
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-line': 2 },
            destinations: {},
            kept: {}
        })
        game.act(ActionType.Occupy, french, { orders: [ridingOn] })
        const state = game.hydrated
        expect(state.unit('F-cav').position).toEqual({ locale: BEYOND })
        expect(state.roadMarch).toMatchObject({ path: [TAKEN, BEYOND] })
        const further = state.map
            .roadLinksFrom(BEYOND)
            .find((link) => link.main && link.to !== TAKEN)
        expect(further).toBeDefined()
        game.act(ActionType.Move, french, {
            order: { ...rider, road: [further?.to], continues: true },
            to: { locale: further?.to }
        })
        expect(game.hydrated.roadMarch).toBeUndefined()
        expect(game.hydrated.unit('F-cav').shown).toEqual(cavalry(2))
        expect(game.hydrated.getPlayerState(french).independentCommandsUsed).toBe(1)
    })

    it('ends its move, and is shown, as soon as another command is given', () => {
        const game = taken(true)
        const french = game.playerOf(Side.French)
        game.act(ActionType.Move, french, {
            order: { kind: CommandKind.Unit, unitIds: ['F-inf'] },
            to: { locale: NEAR }
        })
        const state = game.hydrated
        expect(state.roadMarch).toBeUndefined()
        expect(state.unit('F-cav').shown).toEqual(cavalry(2))
        expect(() =>
            game.act(ActionType.Move, french, {
                order: { ...rider, road: [BEYOND], continues: true },
                to: { locale: BEYOND }
            })
        ).toThrow(/No road move/)
    })

    it('may end blocking an approach its road crosses', () => {
        const game = taken(true)
        const facing = approach(game, TAKEN, BEYOND)
        game.act(ActionType.Move, game.playerOf(Side.French), {
            order: { ...rider, continues: true },
            to: { locale: TAKEN, approach: facing }
        })
        const state = game.hydrated
        expect(state.unit('F-cav').position).toEqual({ locale: TAKEN, approach: facing })
        expect(state.roadMarch).toBeUndefined()
        expect(state.unit('F-cav').shown).toEqual(cavalry(2))
    })
})

describe('threats by cavalry still a road away', () => {
    it('needs road movement left to enter the defense locale', () => {
        const game = frenchTurn([
            { id: 'F-cav', side: Side.French, face: cavalry(2), locale: 38 },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: ASIDE },
            { id: 'A-main', side: Side.Allied, face: infantry(2), locale: TAKEN }
        ])
        const french = game.playerOf(Side.French)
        expect(() =>
            game.act(ActionType.ThreatenAttack, french, { approach: approach(game, NEAR, ASIDE) })
        ).toThrow(/No piece could attack/)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, NEAR, TAKEN) })
        expect(game.state.machineState).toBe(MachineState.DefenseResponse)
    })
})

describe('a cavalry corps of two or more units attacking by road', () => {
    const corps = {
        kind: CommandKind.Corps,
        commanderId: 'murat',
        unitIds: ['F-c1', 'F-c2'],
        road: [NEAR]
    }
    const placements: PiecePlacement[] = [
        { id: 'F-c1', side: Side.French, face: cavalry(2), locale: WEST, commanderId: 'murat' },
        { id: 'F-c2', side: Side.French, face: cavalry(2), locale: WEST, commanderId: 'murat' },
        { id: 'A-1', side: Side.Allied, face: cavalry(2), locale: TAKEN, commanderId: 'bagration' },
        { id: 'A-2', side: Side.Allied, face: cavalry(2), locale: TAKEN, commanderId: 'bagration' }
    ]

    function threatened(): TestGame {
        const game = frenchTurn(placements)
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: approach(game, NEAR, TAKEN)
        })
        return game
    }

    it('halts beside an enemy corps that stands, so only one unit can ride up to feint', () => {
        const game = threatened()
        const french = game.playerOf(Side.French)
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-1'],
            leaderIds: []
        })
        expect(() =>
            game.act(ActionType.DeclareFeint, french, { orders: [corps], end: FeintEnd.Reserve })
        ).toThrow(/must halt/)
        game.act(ActionType.DeclareFeint, french, {
            orders: [{ ...corps, unitIds: ['F-c1'] }],
            end: FeintEnd.Reserve
        })
        const state = game.hydrated
        expect(state.unit('F-c1').position).toEqual({ locale: NEAR })
        expect(state.commander('murat').position).toEqual({ locale: NEAR })
        expect(state.unit('F-c2').position).toEqual({ locale: WEST })
        expect(state.unit('F-c2').commanderId).toBeUndefined()
    })

    it('rides in whole once the enemy corps has broken up in retreat', () => {
        const game = threatened()
        const french = game.playerOf(Side.French)
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-1': BEYOND, 'A-2': BEYOND },
            kept: { bagration: 'A-1' }
        })
        game.act(ActionType.Occupy, french, { orders: [corps] })
        const state = game.hydrated
        expect(state.unit('F-c1').position).toEqual({ locale: TAKEN })
        expect(state.unit('F-c2').position).toEqual({ locale: TAKEN })
        expect(state.roadMarch).toMatchObject({
            kind: CommandKind.Corps,
            commanderId: 'murat',
            path: [NEAR, TAKEN]
        })
        expect(state.limits.marchedLocales).toEqual([NEAR, TAKEN])
    })
})

describe('the fixed battery', () => {
    const gun = { kind: CommandKind.Unit, unitIds: ['F-fixed'] }

    function emplaced(from: number, into: number): TestGame {
        const game = frenchTurn([
            { id: 'F-fixed', side: Side.French, face: artillery(), locale: from, facing: into },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: into }
        ])
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
        })
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: approach(game, from, into)
        })
        return game
    }

    it('fires where it stands', () => {
        const game = emplaced(NEAR, TAKEN)
        const french = game.playerOf(Side.French)
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.DeclareAttack, french, {
            orders: [gun],
            wide: false,
            leaderIds: ['F-fixed']
        })
        const state = game.hydrated
        expect(state.unit('A-inf').face).toEqual(infantry(2))
        expect(state.unit('F-fixed').position).toEqual({
            locale: NEAR,
            approach: approach(game, NEAR, TAKEN)
        })
    })

    it('never moves, by a move or by following up a retreat', () => {
        const game = emplaced(NEAR, TAKEN)
        const french = game.playerOf(Side.French)
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-inf': 2 },
            destinations: { 'A-inf': BEYOND },
            kept: {}
        })
        expect(() => game.act(ActionType.Occupy, french, { orders: [gun] })).toThrow(/cannot move/)
        game.act(ActionType.Occupy, french, { orders: [gun], artilleryStays: true })
        expect(game.hydrated.unit('F-fixed').position?.locale).toBe(NEAR)
        expect(() =>
            game.act(ActionType.Move, french, { order: gun, to: { locale: NEAR } })
        ).toThrow()
    })

    it('holds its ground after a retreat only if it could have fired', () => {
        const game = emplaced(TAKEN, BEYOND)
        const facing = approach(game, TAKEN, BEYOND)
        game.arrange((state) => {
            state.artilleryFire[String(facing)] = state.round - 1
        })
        const [refuge] = game.hydrated.map
            .reachableNeighbours(BEYOND)
            .filter((locale) => locale !== TAKEN)
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-inf': 2 },
            destinations: { 'A-inf': refuge },
            kept: {}
        })
        expect(() =>
            game.act(ActionType.Occupy, game.playerOf(Side.French), {
                orders: [gun],
                artilleryStays: true
            })
        ).toThrow(/could have led/)
    })
})

describe('feinting from reserve', () => {
    it('does not count as moving into the reserve the pieces already stood in', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(2), locale: NEAR },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: TAKEN }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, NEAR, TAKEN) })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        game.act(ActionType.DeclareFeint, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            end: FeintEnd.Reserve
        })
        expect(game.hydrated.unit('F-inf').enteredReserveThisTurn).toBeUndefined()
        expect(game.hydrated.unit('F-inf').movesThisTurn).toBe(1)
    })
})

describe('a fixed battery that is the last unit of its corps', () => {
    it('can be given no command, so it makes no threat', () => {
        const game = frenchTurn([
            {
                id: 'F-fixed',
                side: Side.French,
                face: artillery(),
                locale: NEAR,
                facing: TAKEN,
                commanderId: 'lannes'
            },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: TAKEN }
        ])
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
        })
        expect(() =>
            game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
                approach: approach(game, NEAR, TAKEN)
            })
        ).toThrow(/No piece could attack/)
    })
})

describe('cavalry reinforcements attacking as they come on', () => {
    const ENTRY = 51
    const AHEAD = 38

    function waiting(commanderId: string): TestGame {
        const game = frenchTurn([
            { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: AHEAD }
        ])
        game.arrange((state) => {
            const commander = state.commander(commanderId)
            commander.eliminated = undefined
            state.units.push({
                id: 'F-off',
                playerId: commander.playerId,
                face: cavalry(2),
                commanderId
            })
        })
        return game
    }

    it('may threaten from the entry locale and ride in if the defender gives way', () => {
        const game = waiting('bernadotte')
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, ENTRY, AHEAD) })
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-screen': 52 },
            kept: {}
        })
        const entry = game.hydrated.map
            .entries(Side.French)
            .find((candidate) => candidate.locale === ENTRY && candidate.main)
        game.act(ActionType.Occupy, french, {
            orders: [
                {
                    kind: CommandKind.Corps,
                    commanderId: 'bernadotte',
                    unitIds: ['F-off'],
                    entryId: entry?.id,
                    road: [ENTRY]
                }
            ]
        })
        const state = game.hydrated
        expect(state.unit('F-off').position).toEqual({ locale: AHEAD })
        expect(state.frenchReinforcementsEntered).toBe(true)
        expect(state.playerOf(Side.French).morale).toBe(27)
    })

    it('must wait for the round the Time Track gives its corps', () => {
        const game = waiting('davout')
        expect(() =>
            game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
                approach: approach(game, ENTRY, AHEAD)
            })
        ).toThrow(/No piece could attack/)
    })
})
