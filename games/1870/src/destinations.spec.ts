import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    RouteEvaluation,
    RouteNetwork,
    cashOwnedBy,
    connectedWithin,
    stopValue,
    usesStationAt
} from '@tabletop/18xx'
import { giveTrain, operated, prepared, route, trackAlong, type Table } from '../test/kit.js'
import { DestinationRuns1870 } from './destinations.js'
import { Definition } from './definition/gameDefinition.js'
import { Map1870 } from './map.js'
import { RouteRules1870 } from './routes.js'
import { Market1870 } from './stockMarket.js'
import { TileSet1870 } from './tiles.js'

// Jackson up the east bank to Chicago: one town on the way at G20.
const ToChicago = ['K16', 'J17', 'I18', 'H19', 'G20', 'F21', 'E20', 'D21', 'C20', 'B21', 'A22']

function connected(train = '12', extra: (state: Table['state']) => void = () => undefined) {
    return prepared((state) => {
        const president = state.players[0].playerId
        operated(state, 'IC', president)
        state.tileInventory = TileSet1870.createInventory(trackAlong(ToChicago))
        giveTrain(state, 'IC', train)
        extra(state)
    })
}

function passStockRound(game: Table) {
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
}

const icTrain = (game: Table) => {
    const train = game.state.trainInventory.trains.find(
        (entry) =>
            entry.status === 'owned' &&
            entry.owner.kind === 'company' &&
            entry.owner.companyId === 'IC'
    )
    assertExists(train, 'IC owns a train')
    return train.id
}

describe('connection runs (p. 22)', () => {
    it('is due once a train can run from home to destination, not before', () => {
        const short = connected('2')
        passStockRound(short)
        expect(short.state.machineState).not.toBe('PlacingDestinationStation')
        const long = connected('12')
        passStockRound(long)
        expect(long.state.destinationRun).toEqual({ companyId: 'IC' })
        expect(long.state.machineState).toBe('PlacingDestinationStation')
        expect(long.player).toBe(long.state.players[0].playerId)
    })

    it('counts only as far as a train reaches, town by town', () => {
        const hydrate = (game: Table) => Definition.runtime.hydrator.hydrateState(game.state)
        // Jackson, G20, E20, D21 and Chicago are five stops.
        expect(DestinationRuns1870.eligible(hydrate(connected('4')), 'IC')).toBe(false)
        expect(DestinationRuns1870.eligible(hydrate(connected('5')), 'IC')).toBe(true)
    })

    describe('the bounded connection search', () => {
        const home = { locationId: 'K16', nodeId: 'city' }
        const chicago = { locationId: 'A22', nodeId: 'offboard' }
        const within = (game: Table, stops: number, maximumSteps?: number) =>
            connectedWithin(
                new RouteNetwork(
                    new RailwayMapState(Map1870, TileSet1870, game.state.tileInventory)
                ),
                game.state,
                'IC',
                home,
                chicago,
                stops,
                undefined,
                maximumSteps
            )

        it('settles an unconnected pair without any search', () => {
            const game = prepared((state) => operated(state, 'IC', state.players[0].playerId))
            expect(within(game, 12, 0)).toBe(false)
        })

        it('settles an unlimited train from reach alone', () => {
            expect(within(connected(), Infinity, 0)).toBe(true)
        })

        it('finds a route within its steps and gives up, without failing, past them', () => {
            expect(within(connected(), 5)).toBe(true)
            expect(within(connected(), 4)).toBe(false)
            expect(within(connected(), 5, 1)).toBe(false)
        })
    })

    it('places the station on the map, doubling the city, or keeps it as a $100 station', () => {
        const game = connected()
        passStockRound(game)
        game.act('ChooseDestinationStation', { companyId: 'IC', onMap: true })
        expect(game.state.machineState).toBe('RunningTrains')
        expect(usesStationAt(game.state, 'IC', 'A22', 'offboard')).toBe(true)
        expect(game.state.destinationStations).toEqual(['IC'])

        const kept = connected()
        passStockRound(kept)
        kept.act('ChooseDestinationStation', { companyId: 'IC', onMap: false })
        expect(usesStationAt(kept.state, 'IC', 'A22', 'offboard')).toBe(false)
        expect(kept.state.destinationStations).toEqual([])
        expect(kept.state.stations.find((station) => station.id === 'IC:destination')?.status).toBe(
            'available'
        )
    })

    it('needs a train run from home to destination, and pays that city double', () => {
        const game = connected()
        passStockRound(game)
        game.act('ChooseDestinationStation', { companyId: 'IC', onMap: true })
        const trainId = icTrain(game)
        const start = { locationId: 'K16', nodeId: 'city' }
        const whole = route(game.state, trainId, start, ToChicago.slice(1))
        const evaluation = new RouteEvaluation(
            Definition.runtime.hydrator.hydrateState(game.state),
            RouteRules1870
        ).evaluate('IC', [whole])
        assertExists(evaluation.result, evaluation.reason)
        const [run] = evaluation.result.routes
        expect(run.bonuses).toContainEqual(
            expect.objectContaining({ locationId: 'A22', amount: 40, sourceIds: ['destination'] })
        )
        const partway = route(game.state, trainId, start, ['J17', 'I18', 'H19', 'G20'])
        expect(() => game.act('RunTrains', { companyId: 'IC', routes: [partway] })).toThrow()
        game.act('RunTrains', { companyId: 'IC', routes: [whole] })
        expect(game.state.machineState).toBe('DistributingEarnings')
    })

    it('pays or withholds, moving right only when paid, then goes on with the round', () => {
        const run = (choice: 'pay' | 'withhold') => {
            const game = connected()
            passStockRound(game)
            game.act('ChooseDestinationStation', { companyId: 'IC', onMap: false })
            const trainId = icTrain(game)
            const whole = route(
                game.state,
                trainId,
                { locationId: 'K16', nodeId: 'city' },
                ToChicago.slice(1)
            )
            game.act('RunTrains', { companyId: 'IC', routes: [whole] })
            const before = cashOwnedBy(game.state, { kind: 'company', companyId: 'IC' })
            game.act('DistributeEarnings', { companyId: 'IC', choice })
            return { game, before }
        }
        const price = (game: Table) => Market1870.companySpace(game.state.stockMarket, 'IC').price
        const paid = run('pay').game
        expect(price(paid)).toBe(110)
        expect(paid.state.destinationRunsMade).toEqual(['IC'])
        expect(paid.state.destinationRun).toBeUndefined()
        expect(paid.state.routeStep).toBeUndefined()
        const withheld = run('withhold').game
        expect(price(withheld)).toBe(100)
        // The company then takes its ordinary turn, no second connection run due.
        expect(withheld.state.machineState).toBe('LayingTrack')
    })

    it('refuses a half dividend on the connection run', () => {
        const game = connected()
        passStockRound(game)
        game.act('ChooseDestinationStation', { companyId: 'IC', onMap: false })
        const whole = route(
            game.state,
            icTrain(game),
            { locationId: 'K16', nodeId: 'city' },
            ToChicago.slice(1)
        )
        game.act('RunTrains', { companyId: 'IC', routes: [whole] })
        expect(() =>
            game.act('DistributeEarnings', { companyId: 'IC', choice: 'half-pay' })
        ).toThrow()
    })

    it('has no choice when a station is already at the destination', () => {
        const game = prepared((state) => {
            const president = state.players[0].playerId
            operated(state, 'GMO', president)
            const hexes = [
                'M20',
                'L19',
                'K18',
                'J19',
                'I18',
                'H19',
                'G18',
                'F19',
                'E18',
                'D19',
                'C18'
            ]
            state.tileInventory = TileSet1870.createInventory(trackAlong(hexes))
            state.stations = state.stations.map((station) =>
                station.id === 'GMO:station:1'
                    ? {
                          id: station.id,
                          companyId: 'GMO',
                          status: 'placed',
                          position: { locationId: 'C18', nodeId: 'city', slot: 0 }
                      }
                    : station
            )
            state.stationReservations = state.stationReservations.filter(
                (reservation) => reservation.companyId !== 'MP'
            )
            giveTrain(state, 'GMO', '12')
        })
        passStockRound(game)
        expect(game.state.machineState).toBe('RunningTrains')
        expect(game.state.destinationRun?.companyId).toBe('GMO')
        expect(
            game.state.stations.find((station) => station.id === 'GMO:destination')?.status
        ).toBe('available')
    })
})

describe('a destination station', () => {
    it('counts its city’s value again only at the end of a run', () => {
        const game = connected()
        passStockRound(game)
        game.act('ChooseDestinationStation', { companyId: 'IC', onMap: true })
        const state = Definition.runtime.hydrator.hydrateState(game.state)
        const definition = RouteRules1870.depot.trainDefinition('12')
        const policy = RouteRules1870.revenuePolicy?.(definition, state, 'IC')
        expect(policy?.connectionBonuses?.[0].destinationAtEnd).toBe(true)
        expect(policy?.connectionBonuses?.[0].to).toEqual({ A22: 40 })
        const node = RouteRules1870.map.location('A22').preprintedTile.nodes[0]
        assertExists(node, 'Chicago is a stop')
        expect(
            node.kind !== 'junction' &&
                stopValue(
                    state,
                    RouteRules1870,
                    'IC',
                    { locationId: 'A22', nodeId: node.id },
                    node,
                    definition
                )
        ).toBe(40)
    })
})
