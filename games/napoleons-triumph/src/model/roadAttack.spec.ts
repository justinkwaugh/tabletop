import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    TestGame,
    alliedTurn,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement,
    defendWith
} from '../testing/harness.js'
import { RIDDEN_IN, reinforcementCavalryRiddenIn, waitOffMap } from '../testing/reinforcements.js'
import { CommandKind } from './attack.js'
import { FeintEnd } from './attackDeclaration.js'
import { rideOnAttackOrder, roadAttackOrder, roadAttackOrders } from './attackOrders.js'

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

    function taken(byRoad: boolean, others: readonly PiecePlacement[] = []): TestGame {
        const game = frenchTurn([...placements, ...others])
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

    it('is shown as it takes the locale, and may ride on after the defender gives way', () => {
        const state = taken(true).hydrated
        expect(state.unit('F-cav').position).toEqual({ locale: TAKEN })
        expect(state.roadMarch).toMatchObject({ unitIds: ['F-cav'], start: NEAR, path: [TAKEN] })
        expect(state.unit('F-cav').shown).toEqual(cavalry(2))
        expect(state.machineState).toBe(MachineState.Commanding)
    })

    it('has made an ordinary move, with nothing more to come, when it did not take the road', () => {
        const game = taken(false)
        expect(game.hydrated.roadMarch).toBeUndefined()
        expect(game.hydrated.unit('F-cav').shown).toBeUndefined()
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
        expect(game.hydrated.roadMarch).toBeDefined()
        expect(game.hydrated.unit('F-cav').shown).toEqual(cavalry(2))
        defendWith(game, allied, ['A-line'])
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
        expect(state.unit('A-line').position).toEqual({
            locale: BEYOND,
            approach: approach(game, BEYOND, TAKEN)
        })
        expect(state.machineState).toBe(MachineState.Commanding)
    })

    it('takes a second locale when that defender gives way too, and when the road runs out can only end blocking an approach', () => {
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
        assertExists(further, 'Expected the main road to go on')
        game.act(ActionType.Move, french, {
            order: { ...rider, road: [further.to], continues: true },
            to: { locale: further.to }
        })
        expect(game.hydrated.roadMarch).toMatchObject({ stopped: true })
        expect(() =>
            game.act(ActionType.Move, french, {
                order: { ...rider, road: [BEYOND], continues: true },
                to: { locale: BEYOND }
            })
        ).toThrow(/has stopped/)
        const behind = approach(game, further.to, BEYOND)
        game.act(ActionType.Move, french, {
            order: { ...rider, continues: true },
            to: { locale: further.to, approach: behind }
        })
        const ended = game.hydrated
        expect(ended.unit('F-cav').position).toEqual({ locale: further.to, approach: behind })
        expect(ended.roadMarch).toBeUndefined()
        expect(ended.unit('F-cav').shown).toEqual(cavalry(2))
        expect(ended.getPlayerState(french).independentCommandsUsed).toBe(1)
    })

    it('ends its move as soon as another command is given', () => {
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
        ).toThrow()
    })

    it('ends its move when another command threatens an attack it cannot ride into', () => {
        const map = new TestGame().hydrated.map
        const flank = map
            .adjacentLocales(WEST)
            .find(
                (locale) =>
                    ![NEAR, TAKEN, BEYOND].includes(locale) &&
                    !map.adjacentLocales(locale).includes(TAKEN) &&
                    !map.approachBetween(WEST, locale).impassable
            )
        assertExists(flank, 'Expected a locale beside the infantry and away from the rider')
        const game = taken(true, [
            { id: 'A-flank', side: Side.Allied, face: infantry(2), locale: flank }
        ])
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: approach(game, WEST, flank),
            plan: { kind: CommandKind.Unit, unitIds: ['F-inf'] }
        })
        const state = game.hydrated
        expect(state.roadMarch).toBeUndefined()
        expect(state.unit('F-cav').shown).toEqual(cavalry(2))
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

describe('the command a road attack is made by', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-c1', side: Side.French, face: cavalry(2), locale: NEAR, commanderId: 'murat' },
        { id: 'F-c2', side: Side.French, face: cavalry(2), locale: NEAR, commanderId: 'murat' },
        { id: 'F-lone', side: Side.French, face: cavalry(2), locale: NEAR, commanderId: 'lannes' },
        { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: TAKEN }
    ]

    function ordersFor(unitIds: string[], wanted?: CommandKind) {
        const game = frenchTurn(placements)
        const state = game.hydrated
        const site = {
            attackerId: game.playerOf(Side.French),
            attackApproach: approach(game, NEAR, TAKEN)
        }
        const units = unitIds.map((id) => state.unit(id))
        return {
            offered: roadAttackOrders(state, site, units).map((order) => order.kind),
            chosen: roadAttackOrder(state, site, units, wanted)
        }
    }

    it('is a Unit Move for one unit of a larger corps, which leaves its commander behind', () => {
        const { offered, chosen } = ordersFor(['F-c1'])
        expect(offered).toEqual([CommandKind.Unit, CommandKind.Corps])
        expect(chosen).toMatchObject({ kind: CommandKind.Unit, unitIds: ['F-c1'] })
        expect(chosen?.commanderId).toBeUndefined()
    })

    it('is a Corps Move for the same unit when that is asked for', () => {
        const { chosen } = ordersFor(['F-c1'], CommandKind.Corps)
        expect(chosen).toMatchObject({ kind: CommandKind.Corps, commanderId: 'murat' })
    })

    it('is a Corps Move when the units named are the whole corps', () => {
        expect(ordersFor(['F-c1', 'F-c2']).offered).toEqual([CommandKind.Corps])
        expect(ordersFor(['F-lone']).chosen).toMatchObject({
            kind: CommandKind.Corps,
            commanderId: 'lannes'
        })
    })
})

describe('threats by cavalry still a road away', () => {
    it('must be feinted when the defender stands, since nothing in the attack locale could press', () => {
        const game = frenchTurn([
            { id: 'F-cav', side: Side.French, face: cavalry(2), locale: WEST },
            { id: 'A-main', side: Side.Allied, face: infantry(2), locale: TAKEN }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, NEAR, TAKEN) })
        defendWith(game, game.playerOf(Side.Allied), ['A-main'])
        expect(() => game.act(ActionType.PressAttack, french)).toThrow(/not valid/)
        expect(game.hydrated.unit('A-main').shown).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
    })

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
        defendWith(game, game.playerOf(Side.Allied), ['A-1'])
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

    const map = new TestGame().hydrated.map
    const besideTaken = map
        .adjacentLocales(TAKEN)
        .find(
            (locale) =>
                ![NEAR, BEYOND].includes(locale) && !map.adjacentLocales(NEAR).includes(locale)
        )
    assertExists(besideTaken, 'Expected a locale beside the one taken and away from the road')
    const flank: number = besideTaken

    function stoppedBesideFlank(others: readonly PiecePlacement[] = []): TestGame {
        const game = frenchTurn([
            ...placements,
            ...others,
            {
                id: 'A-3',
                side: Side.Allied,
                face: infantry(2),
                locale: flank,
                commanderId: 'constantine'
            },
            {
                id: 'A-4',
                side: Side.Allied,
                face: infantry(2),
                locale: flank,
                commanderId: 'constantine'
            }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, NEAR, TAKEN) })
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-1': BEYOND, 'A-2': BEYOND },
            kept: { bagration: 'A-1' }
        })
        game.act(ActionType.Occupy, french, { orders: [corps] })
        return game
    }

    it('stops on riding in beside another enemy corps, and may then only end blocking an approach', () => {
        const game = stoppedBesideFlank()
        const french = game.playerOf(Side.French)
        expect(game.hydrated.roadMarch).toMatchObject({ stopped: true, path: [NEAR, TAKEN] })

        const ridingOn = { ...corps, road: [BEYOND], continues: true as const }
        expect(() =>
            game.act(ActionType.Move, french, { order: ridingOn, to: { locale: BEYOND } })
        ).toThrow(/has stopped/)
        expect(() =>
            game.act(ActionType.ThreatenAttack, french, { approach: approach(game, TAKEN, BEYOND) })
        ).toThrow(/No piece could attack/)

        const behind = approach(game, TAKEN, NEAR)
        game.act(ActionType.Move, french, {
            order: { ...corps, road: undefined, continues: true },
            to: { locale: TAKEN, approach: behind }
        })
        const state = game.hydrated
        expect(state.unit('F-c1').position).toEqual({ locale: TAKEN, approach: behind })
        expect(state.commander('murat').position).toEqual({ locale: TAKEN, approach: behind })
        expect(state.roadMarch).toBeUndefined()
    })

    it('ends its stopped move when another command threatens', () => {
        const outside = map
            .adjacentLocales(flank)
            .find(
                (locale) =>
                    ![WEST, NEAR, TAKEN, BEYOND].includes(locale) &&
                    !map.approachBetween(locale, flank).impassable
            )
        assertExists(outside, 'Expected another locale beside the flank')
        const game = stoppedBesideFlank([
            { id: 'F-inf', side: Side.French, face: infantry(2), locale: outside }
        ])
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: approach(game, outside, flank),
            plan: { kind: CommandKind.Unit, unitIds: ['F-inf'] }
        })
        const state = game.hydrated
        expect(state.roadMarch).toBeUndefined()
        expect(state.unit('F-c1').shown).toEqual(cavalry(2))
        expect(state.unit('F-c2').shown).toEqual(cavalry(2))
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
        expect(state.unit('F-c1').shown).toEqual(cavalry(2))
        expect(state.unit('F-c2').shown).toEqual(cavalry(2))
        expect(state.roadMarch).toMatchObject({
            kind: CommandKind.Corps,
            commanderId: 'murat',
            path: [NEAR, TAKEN]
        })
        expect(state.limits.marchedLocales).toEqual([NEAR, TAKEN])
    })

    it('shows only the units that ride in, not those detached before it set out', () => {
        const game = threatened()
        const french = game.playerOf(Side.French)
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-1': BEYOND, 'A-2': BEYOND },
            kept: { bagration: 'A-1' }
        })
        game.act(ActionType.Occupy, french, { orders: [{ ...corps, unitIds: ['F-c1'] }] })
        const state = game.hydrated
        expect(state.unit('F-c1').position).toEqual({ locale: TAKEN })
        expect(state.unit('F-c1').shown).toEqual(cavalry(2))
        expect(state.unit('F-c2').position).toEqual({ locale: WEST })
        expect(state.unit('F-c2').shown).toBeUndefined()
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
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
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

    it('cannot press an attack it may not fire in, when cavalry up the road made the threat', () => {
        const game = frenchTurn([
            { id: 'F-fixed', side: Side.French, face: artillery(), locale: TAKEN, facing: BEYOND },
            { id: 'F-cav', side: Side.French, face: cavalry(2), locale: NEAR },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: BEYOND }
        ])
        const facing = approach(game, TAKEN, BEYOND)
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
            state.playerOf(Side.French).artilleryFire = { [String(facing)]: state.round - 1 }
        })
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, { approach: facing })
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])

        expect(() => game.act(ActionType.PressAttack, french)).toThrow()
        game.act(ActionType.DeclareFeint, french, {
            orders: [{ ...rider, road: [TAKEN] }],
            end: FeintEnd.Reserve
        })
        expect(game.hydrated.attack).toBeUndefined()
        expect(game.hydrated.unit('F-cav').position).toEqual({ locale: TAKEN })
    })

    it('holds its ground after a retreat only if it could have fired', () => {
        const game = emplaced(TAKEN, BEYOND)
        const facing = approach(game, TAKEN, BEYOND)
        game.arrange((state) => {
            state.playerOf(Side.French).artilleryFire = { [String(facing)]: state.round - 1 }
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
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
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
        waitOffMap(game, commanderId, [{ id: 'F-off', face: cavalry(2) }])
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

describe('cavalry reinforcements riding on in their turn of entry', () => {
    const { entry: ENTRY, taken: TAKEN, held: HELD, corps } = RIDDEN_IN
    const ridden = reinforcementCavalryRiddenIn

    it('may ride on, or attack again by road under a new command', () => {
        const game = ridden()
        const state = game.hydrated
        const site = {
            attackerId: game.playerOf(Side.French),
            attackApproach: approach(game, TAKEN, HELD)
        }
        const riders = [state.unit('F-off')]
        expect(state.roadMarch).toMatchObject({ unitIds: ['F-off'], path: [ENTRY, TAKEN] })
        expect(state.unit('F-off').shown).toEqual(cavalry(2))
        expect(rideOnAttackOrder(state, site, riders)).toMatchObject({ continues: true })
        expect(roadAttackOrders(state, site, riders)).toEqual([{ ...corps, road: [] }])
    })

    it('may be given its second command in place of riding on, which ends the ride', () => {
        const game = ridden()
        const french = game.playerOf(Side.French)
        game.act(ActionType.Move, french, { order: corps, to: { locale: ENTRY } })
        const state = game.hydrated
        expect(state.unit('F-off').position).toEqual({ locale: ENTRY })
        expect(state.roadMarch).toBeUndefined()
        expect(state.unit('F-off').shown).toEqual(cavalry(2))
        expect(() =>
            game.act(ActionType.Move, french, { order: corps, to: { locale: TAKEN } })
        ).toThrow()
    })

    it('may press an attack with its second command, which riding on cannot do', () => {
        const game = ridden()
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: approach(game, TAKEN, HELD),
            plan: { kind: CommandKind.Corps, unitIds: ['F-off'] }
        })
        defendWith(game, game.playerOf(Side.Allied), ['A-line'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
        expect(() =>
            game.act(ActionType.DeclareAttack, french, {
                orders: [{ ...corps, road: [], continues: true }],
                wide: false,
                leaderIds: []
            })
        ).toThrow(/must be a feint/)
        game.act(ActionType.DeclareAttack, french, { orders: [corps], wide: false, leaderIds: [] })
        const state = game.hydrated
        expect(state.roadMarch).toBeUndefined()
        expect(state.commander('bernadotte').commandsThisTurn).toBe(2)
    })
})

describe('cavalry riding on that is no reinforcement', () => {
    it('has no new command to attack by', () => {
        const game = frenchTurn([
            { id: 'F-cav', side: Side.French, face: cavalry(2), locale: 53 },
            { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: 63 },
            { id: 'A-line', side: Side.Allied, face: infantry(2), locale: 64 }
        ])
        const french = game.playerOf(Side.French)
        const unitMove = { kind: CommandKind.Unit, unitIds: ['F-cav'] }
        game.act(ActionType.ThreatenAttack, french, { approach: approach(game, 53, 63) })
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-screen': 72 },
            kept: {}
        })
        game.act(ActionType.Occupy, french, { orders: [{ ...unitMove, road: [] }] })
        const state = game.hydrated
        const site = { attackerId: french, attackApproach: approach(game, 63, 64) }
        const riders = [state.unit('F-cav')]
        expect(rideOnAttackOrder(state, site, riders)).toMatchObject({ continues: true })
        expect(roadAttackOrders(state, site, riders)).toEqual([])
    })
})

describe('reinforcements that could attack by more than one entry road', () => {
    it('take the road that leaves them every road beyond the others do', () => {
        const ENTRY = 59
        const INTO = 50
        const game = alliedTurn([
            { id: 'F-screen', side: Side.French, face: cavalry(1), locale: INTO }
        ])
        waitOffMap(game, 'bagration', [{ id: 'A-off', face: cavalry(2) }])
        const state = game.hydrated
        const site = {
            attackerId: game.playerOf(Side.Allied),
            attackApproach: approach(game, ENTRY, INTO)
        }
        const roadsInto = (entryId: string) =>
            state.map.traceRoad({ entryId }, [ENTRY, INTO]).map((arrival) => arrival.group)
        expect(roadsInto('A13')).toEqual([1])
        expect(roadsInto('A14').toSorted()).toEqual([0, 1])
        expect(roadAttackOrder(state, site, [state.unit('A-off')])).toMatchObject({
            entryId: 'A14',
            road: [ENTRY]
        })
    })
})
