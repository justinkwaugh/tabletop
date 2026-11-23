import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    assertExists,
    type GameAction,
    type GameConfig
} from '@tabletop/common'
import { createGame } from '../testing/bot.js'
import { HydratedLwGameState, type LwGameState } from '../model/gameState.js'
import { LocomotiveId } from '../model/locomotives.js'
import { isPayTaxes } from '../actions/payTaxes.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import { isShip } from '../actions/ship.js'
import { ActionType } from './actions.js'
import { LwRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { PhaseName } from '../stateHandlers/flow.js'
import { StartingCash } from './gameConfig.js'
import { diceOnSpace } from '../model/market.js'

const engine = new GameEngine(LwRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

type Table = { game: ReturnType<typeof createGame>; state: LwGameState; actions: GameAction[] }

// The scenarios below count from $12 each, which Queen Start Money gives every table size but five.
const QUEEN_CASH: GameConfig = { startingCash: StartingCash.Queen }

function start(count: number, config: GameConfig = QUEEN_CASH): Table {
    const game = createGame(count, config)
    const order = game.players.map((player) => player.id)
    const { initialState } = engine.startGame(game, {
        masterSeed,
        startingPositions: { playerIds: order }
    })
    return { game, state: initialState, actions: [] }
}

function hydrate(table: Table): HydratedLwGameState {
    return new HydratedLwGameState(structuredClone(table.state))
}

let step = 0
function run(table: Table, action: Record<string, unknown>): Table {
    const [playerId] = table.state.activePlayerIds
    assertExists(playerId, `Nobody acts in ${table.state.machineState}`)
    const full: GameAction = {
        id: `t${step++}`,
        gameId: table.game.id,
        source: ActionSource.User,
        playerId,
        type: ActionType.PassDevelopment,
        ...action
    }
    const result = engine.executeCanonicalAction({
        game: table.game,
        state: table.state,
        action: full
    })
    return {
        game: table.game,
        state: result.updatedState,
        actions: [...table.actions, ...result.processedActions]
    }
}

// Puts every die not yet on the board into Passenger 1's Customer Base.
function fillDicePool(state: HydratedLwGameState) {
    const onBoard = state.spaces.reduce((sum, space) => sum + diceOnSpace(space), 0)
    const passenger = state.space(LocomotiveId.Passenger1)
    passenger.customerBase.push(...Array.from({ length: 20 - onBoard }, () => 1))
}

function edit(table: Table, change: (state: HydratedLwGameState) => void): Table {
    const state = hydrate(table)
    change(state)
    return { ...table, state: state.dehydrate() }
}

const PASSES: Partial<Record<MachineState, Record<string, unknown>>> = {
    [MachineState.Developing]: { type: ActionType.PassDevelopment },
    [MachineState.ExpandingCapacity]: { type: ActionType.ExpandCapacity, purchases: [] }
}

function passUntil(table: Table, machineState: MachineState): Table {
    return passWhile(table, (state) => state.machineState !== machineState)
}

function passWhile(table: Table, going: (state: LwGameState) => boolean): Table {
    let current = table
    while (going(current.state)) {
        const pass = PASSES[current.state.machineState]
        current = run(current, pass ?? { type: ActionType.Ship, locomotiveIds: [] })
    }
    return current
}

describe('setup', () => {
    it.each([
        [3, 10],
        [4, 12]
    ])('gives %i players $%i and a First Generation Passenger works', (count, cash) => {
        const state = hydrate(start(count, {}))
        for (const player of state.players) {
            expect(player.cash).toBe(cash)
            expect(player.plants).toEqual([
                { locomotiveId: LocomotiveId.Passenger1, units: 1, shipped: 0 }
            ])
        }
        const passenger = state.space(LocomotiveId.Passenger1)
        expect(passenger.cards).toBe(4 - count)
        expect(passenger.existingOrders).toHaveLength(3)
        expect(passenger.initialOrder).toBeUndefined()
        expect(state.space(LocomotiveId.Fast1).initialOrder).toBeDefined()
        expect(state.machineState).toBe(MachineState.Developing)
        expect(state.activePlayerIds).toEqual(['p0'])
    })

    it('gives five players $14, no works and one Initial Orders die', () => {
        const state = hydrate(start(5, {}))
        for (const player of state.players) {
            expect(player.cash).toBe(14)
            expect(player.plants).toEqual([])
        }
        const passenger = state.space(LocomotiveId.Passenger1)
        expect(passenger.cards).toBe(4)
        expect(passenger.existingOrders).toEqual([])
        expect(passenger.initialOrder).toBeDefined()
        expect(state.space(LocomotiveId.Fast1).initialOrder).toBeUndefined()
    })

    it.each([
        [StartingCash.Queen, 3, 12],
        [StartingCash.Queen, 4, 12],
        [StartingCash.Queen, 5, 14],
        [StartingCash.Winsome, 3, 10],
        [StartingCash.Winsome, 4, 10],
        [StartingCash.Winsome, 5, 14]
    ])('%s starting cash gives %i players $%i', (startingCash, count, cash) => {
        const state = hydrate(start(count, { startingCash }))
        expect(state.players.every((player) => player.cash === cash)).toBe(true)
    })
})

describe('Locomotive Development', () => {
    it('slides the Initial Orders die and rolls one for the next locomotive', () => {
        let table = start(3)
        const face = hydrate(table).space(LocomotiveId.Fast1).initialOrder
        table = run(table, { type: ActionType.Develop, locomotiveId: LocomotiveId.Fast1 })
        const state = hydrate(table)
        const fast = state.space(LocomotiveId.Fast1)
        expect(fast.initialOrder).toBeUndefined()
        expect(fast.existingOrders).toEqual([face])
        expect(fast.cards).toBe(2)
        expect(state.space(LocomotiveId.Freight1).initialOrder).toBeDefined()
        const developer = state.getPlayerState('p0')
        expect(developer.cash).toBe(4)
        expect(developer.plant(LocomotiveId.Fast1)).toEqual({
            locomotiveId: LocomotiveId.Fast1,
            units: 1,
            shipped: 0
        })
        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('develops only locomotives with orders, cards left and never developed before', () => {
        let table = start(3)
        expect(hydrate(table).developable('p0')).toEqual([LocomotiveId.Fast1])
        table = edit(table, (state) => {
            state.getPlayerState('p0').cash = 100
            state.space(LocomotiveId.Fast1).cards = 0
        })
        expect(hydrate(table).developable('p0')).toEqual([])
    })

    it('removes unbought cards two generations older when a third generation arrives', () => {
        let table = edit(start(3), (state) => {
            state.getPlayerState('p0').cash = 100
            state.space(LocomotiveId.Fast1).initialOrder = undefined
            state.space(LocomotiveId.Passenger3).initialOrder = 4
        })
        table = run(table, { type: ActionType.Develop, locomotiveId: LocomotiveId.Passenger3 })
        const state = hydrate(table)
        expect(state.space(LocomotiveId.Passenger1).cards).toBe(0)
        const develop = table.actions.find(isDevelop)
        expect(develop?.metadata).toMatchObject({
            retiredLocomotiveId: LocomotiveId.Passenger1,
            retiredCards: 1,
            initialOrder: 4,
            nextLocomotiveId: LocomotiveId.Special2
        })
    })

    it('rolls no Initial Orders die for the next locomotive once the pool is empty', () => {
        let table = edit(start(3), fillDicePool)
        table = run(table, { type: ActionType.Develop, locomotiveId: LocomotiveId.Fast1 })
        const state = hydrate(table)
        expect(state.space(LocomotiveId.Fast1).existingOrders).toHaveLength(1)
        expect(state.space(LocomotiveId.Freight1).initialOrder).toBeUndefined()
        const develop = table.actions.find(isDevelop)
        expect(develop?.metadata?.nextLocomotiveId).toBeUndefined()
        expect(develop?.metadata?.nextRoll).toBeUndefined()
        expect(develop?.revealsInfo).toBeFalsy()
    })

    it('develops without the protected dice stream when it rolls nothing', () => {
        const state = hydrate(edit(start(3), fillDicePool))
        state.protectedPrng = undefined
        const develop = new HydratedDevelop({
            id: 'develop',
            gameId: 'lw',
            source: ActionSource.User,
            type: ActionType.Develop,
            playerId: 'p0',
            locomotiveId: LocomotiveId.Fast1
        })
        develop.apply(state)
        expect(develop.revealsInfo).toBeFalsy()
        expect(state.space(LocomotiveId.Fast1).existingOrders).toHaveLength(1)
    })

    it('passes over players who cannot afford any development', () => {
        let table = edit(start(3), (state) => {
            state.getPlayerState('p1').cash = 7
        })
        table = run(table, { type: ActionType.PassDevelopment })
        expect(table.state.activePlayerIds).toEqual(['p2'])
    })
})

describe('Production Capacity', () => {
    it('buys units at the production cost', () => {
        let table = passUntil(start(3), MachineState.ExpandingCapacity)
        const playerId = table.state.activePlayerIds[0]
        table = run(table, {
            type: ActionType.ExpandCapacity,
            purchases: [{ locomotiveId: LocomotiveId.Passenger1, units: 2 }]
        })
        const player = hydrate(table).getPlayerState(playerId)
        expect(player.cash).toBe(8)
        expect(player.requirePlant(LocomotiveId.Passenger1).units).toBe(3)
    })

    it('upgrades units for the difference in production cost and closes an emptied works', () => {
        let table = edit(passUntil(start(3), MachineState.ExpandingCapacity), (state) => {
            const player = state.getPlayerState(state.activePlayerIds[0])
            player.cash = 50
            player.addPlant(LocomotiveId.Passenger4, 1)
            player.addPlant(LocomotiveId.Freight3, 1)
            player.requirePlant(LocomotiveId.Passenger4).units = 1
        })
        const playerId = table.state.activePlayerIds[0]
        const state = hydrate(table)
        expect(state.canShift(playerId, LocomotiveId.Freight3, LocomotiveId.Passenger4, 1)).toBe(
            false
        )
        table = run(table, {
            type: ActionType.ExpandCapacity,
            purchases: [
                { locomotiveId: LocomotiveId.Freight3, from: LocomotiveId.Passenger4, units: 1 }
            ]
        })
        const player = hydrate(table).getPlayerState(playerId)
        expect(player.cash).toBe(48)
        expect(player.plant(LocomotiveId.Passenger4)).toBeUndefined()
        expect(player.requirePlant(LocomotiveId.Freight3).units).toBe(2)
        expect(player.developed).toContain(LocomotiveId.Passenger4)
        expect(
            hydrate(table)
                .developOptions(playerId)
                .map((option) => option.locomotive.id)
        ).not.toContain(LocomotiveId.Passenger4)
    })

    it('upgrades only to a locomotive the player owns', () => {
        const table = edit(passUntil(start(3), MachineState.ExpandingCapacity), (state) => {
            state.getPlayerState(state.activePlayerIds[0]).cash = 50
        })
        const playerId = table.state.activePlayerIds[0]
        const state = hydrate(table)
        expect(state.canShift(playerId, LocomotiveId.Passenger1, LocomotiveId.Passenger2, 1)).toBe(
            false
        )
        state.getPlayerState(playerId).addPlant(LocomotiveId.Passenger2, 0)
        expect(state.canShift(playerId, LocomotiveId.Passenger1, LocomotiveId.Passenger2, 1)).toBe(
            true
        )
    })

    it('passes over a player with nothing they can afford', () => {
        let table = passUntil(start(3), MachineState.ExpandingCapacity)
        const [first, second, third] = hydrate(table).turnManager.turnOrder
        expect(table.state.activePlayerIds).toEqual([first])
        table = edit(table, (state) => {
            state.getPlayerState(second).cash = 0
        })
        table = run(table, { type: ActionType.ExpandCapacity, purchases: [] })
        expect(table.state.machineState).toBe(MachineState.ExpandingCapacity)
        expect(table.state.activePlayerIds).toEqual([third])
    })

    it('takes the whole plan in one action and ends the turn', () => {
        let table = edit(passUntil(start(3), MachineState.ExpandingCapacity), (state) => {
            const player = state.getPlayerState(state.activePlayerIds[0])
            player.cash = 20
            player.addPlant(LocomotiveId.Passenger2, 0)
        })
        const playerId = table.state.activePlayerIds[0]
        const before = table.actions.length
        table = run(table, {
            type: ActionType.ExpandCapacity,
            purchases: [
                { locomotiveId: LocomotiveId.Passenger1, units: 1 },
                { locomotiveId: LocomotiveId.Passenger2, from: LocomotiveId.Passenger1, units: 2 }
            ]
        })
        expect(table.actions).toHaveLength(before + 1)
        const player = hydrate(table).getPlayerState(playerId)
        expect(player.plant(LocomotiveId.Passenger1)).toBeUndefined()
        expect(player.requirePlant(LocomotiveId.Passenger2).units).toBe(2)
        expect(table.state.activePlayerIds).not.toEqual([playerId])
    })

    it('rejects a plan that overspends, leaving nothing bought', () => {
        const table = passUntil(start(3), MachineState.ExpandingCapacity)
        const playerId = table.state.activePlayerIds[0]
        expect(() =>
            run(table, {
                type: ActionType.ExpandCapacity,
                purchases: [
                    { locomotiveId: LocomotiveId.Passenger1, units: 4 },
                    { locomotiveId: LocomotiveId.Passenger1, units: 4 }
                ]
            })
        ).toThrow()
        expect(hydrate(table).getPlayerState(playerId).cash).toBe(12)
    })
})

describe('Pay Taxes', () => {
    it('takes ten percent rounded down and seats the poorest first, ties keeping their order', () => {
        let table = edit(start(4), (state) => {
            state.getPlayerState('p0').cash = 47
            state.getPlayerState('p1').cash = 19
            state.getPlayerState('p2').cash = 47
            state.getPlayerState('p3').cash = 5
        })
        table = passWhile(table, (state) => state.roundManager.series.length < 2)
        const taxes = table.actions.find(isPayTaxes)
        expect(taxes?.metadata?.payments.map((payment) => payment.tax)).toEqual([4, 1, 4, 0])
        expect(hydrate(table).turnManager.turnOrder).toEqual(['p3', 'p1', 'p0', 'p2'])
        expect(hydrate(table).round()).toBe(2)
    })

    it('ends the game when someone has $300 after taxes', () => {
        let table = edit(start(3), (state) => {
            state.getPlayerState('p1').cash = 334
            state.getPlayerState('p2').cash = 320
        })
        table = passUntil(run(table, {}), MachineState.EndOfGame)
        const state = hydrate(table)
        expect(state.getPlayerState('p1').cash).toBe(301)
        expect(state.winningPlayerIds).toEqual(['p1'])
    })
})

describe('Production', () => {
    it('runs another selling round while somebody shipped in the last', () => {
        let table = edit(start(3), (state) => {
            state.space(LocomotiveId.Passenger1).existingOrders = [1, 1, 3]
            for (const player of state.players) {
                player.requirePlant(LocomotiveId.Passenger1).units = 2
            }
        })
        table = passUntil(table, MachineState.Shipping)
        const ship = (current: Table) =>
            run(current, { type: ActionType.Ship, locomotiveIds: [LocomotiveId.Passenger1] })
        // p0 lowers the 3 to 1; p1 and p2 each fill a 1. In the second round only p1 can fill
        // the last 1.
        table = ship(ship(ship(table)))
        expect(table.state.sellingRound?.number).toBe(2)
        expect(table.state.activePlayerIds).toEqual(['p1'])
        table = ship(table)
        const state = hydrate(table)
        expect(state.machineState).toBe(MachineState.Developing)
        expect(state.players.map((player) => player.cash)).toEqual([13, 13, 12])
        expect(state.space(LocomotiveId.Passenger1).existingOrders).toHaveLength(3)
    })
})

describe('Automatic shipping', () => {
    function expandAutomatically(table: Table, autoShip: (playerId: string) => boolean): Table {
        let current = passUntil(table, MachineState.ExpandingCapacity)
        while (current.state.machineState === MachineState.ExpandingCapacity) {
            const [playerId] = current.state.activePlayerIds
            current = run(current, {
                type: ActionType.ExpandCapacity,
                purchases: [],
                autoShip: autoShip(playerId)
            })
        }
        return current
    }

    it('ships everything for a player who asked, in every selling round, then forgets it', () => {
        let table = edit(start(3), (state) => {
            state.space(LocomotiveId.Passenger1).existingOrders = [1, 1, 3]
            for (const player of state.players) {
                player.requirePlant(LocomotiveId.Passenger1).units = 2
            }
            state.getPlayerState('p0').requirePlant(LocomotiveId.Passenger1).units = 4
        })
        const autoShips = (current: Table) =>
            current.actions.filter(
                (action) => isShip(action) && action.source === ActionSource.System
            )
        table = expandAutomatically(table, (playerId) => playerId === 'p0')
        // p0 ships 3 of 4 against the 3 on their own, and p1 is asked.
        expect(autoShips(table)).toMatchObject([{ playerId: 'p0', metadata: { income: 3 } }])
        expect(table.state.activePlayerIds).toEqual(['p1'])
        // p1 and p2 hold, so p0's last unit fills a 1 in the second selling round.
        table = passWhile(table, (state) => state.machineState === MachineState.Shipping)
        expect(autoShips(table)).toMatchObject([
            { playerId: 'p0', metadata: { income: 3, sellingRound: 1 } },
            { playerId: 'p0', metadata: { income: 1, sellingRound: 2 } }
        ])
        const state = hydrate(table)
        expect(state.machineState).toBe(MachineState.Developing)
        expect(state.players.every((player) => player.autoShip === undefined)).toBe(true)
    })

    it('ships straight after buying under Buy and Ship', () => {
        let table = start(3, { buyAndShip: true })
        table = passUntil(table, MachineState.ExpandingCapacity)
        const [first] = table.state.activePlayerIds
        table = run(table, { type: ActionType.ExpandCapacity, purchases: [], autoShip: true })
        expect(table.actions.at(-1)).toMatchObject({
            type: ActionType.Ship,
            playerId: first,
            source: ActionSource.System,
            locomotiveIds: [LocomotiveId.Passenger1]
        })
        expect(table.state.machineState).toBe(MachineState.ExpandingCapacity)
        expect(table.state.activePlayerIds).not.toEqual([first])
    })
})

describe('Buy and Ship', () => {
    it("still applies on games stored with the option's former name", () => {
        let table = start(3, { lucasOrder: true })
        table = passUntil(table, MachineState.ExpandingCapacity)
        expect(hydrate(table).phaseManager.currentPhase?.name).toBe(
            PhaseName.CapacityAndFirstShipment
        )
    })

    it('lets each player buy capacity and then ship before the next player', () => {
        let table = start(3, { buyAndShip: true })
        table = passUntil(table, MachineState.ExpandingCapacity)
        const state = hydrate(table)
        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.CapacityAndFirstShipment)
        const first = state.activePlayerIds[0]
        table = run(table, { type: ActionType.ExpandCapacity, purchases: [] })
        expect(table.state.machineState).toBe(MachineState.Shipping)
        expect(table.state.activePlayerIds).toEqual([first])
        table = run(table, { type: ActionType.Ship, locomotiveIds: [LocomotiveId.Passenger1] })
        expect(table.state.machineState).toBe(MachineState.ExpandingCapacity)
        expect(table.state.activePlayerIds).not.toEqual([first])
    })

    it('sends a player who can buy nothing straight to shipping', () => {
        let table = edit(start(3, { buyAndShip: true }), (state) => {
            state.getPlayerState('p0').cash = 1
        })
        table = passUntil(run(table, {}), MachineState.Shipping)
        expect(table.state.activePlayerIds).toEqual(['p0'])
        expect(hydrate(table).phaseManager.currentPhase?.name).toBe(
            PhaseName.CapacityAndFirstShipment
        )
        table = run(table, { type: ActionType.Ship, locomotiveIds: [LocomotiveId.Passenger1] })
        expect(table.state.machineState).toBe(MachineState.ExpandingCapacity)
        expect(table.state.activePlayerIds).toEqual(['p1'])
    })

    it('keeps the standard phases without it', () => {
        let table = passUntil(start(3), MachineState.ExpandingCapacity)
        table = run(table, { type: ActionType.ExpandCapacity, purchases: [] })
        expect(table.state.machineState).toBe(MachineState.ExpandingCapacity)
    })
})
