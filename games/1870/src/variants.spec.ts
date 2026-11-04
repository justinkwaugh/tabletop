import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    DestinationStationSource,
    destinationStationId,
    placeStockMarker,
    type RevenueCenter
} from '@tabletop/18xx'
import { giveTrain, operated, prepared, table } from '../test/kit.js'
import { placeWarStation, stationWarsAfterLay } from './destinations.js'
import { Definition } from './definition/gameDefinition.js'
import { EndingRules1870, PhaseRules1870 } from './operating.js'
import type { State1870 } from './state.js'
import { Market1870 } from './stockMarket.js'
import { TileSet1870 } from './tiles.js'
import { Phases1870, TrainRules1870 } from './trains.js'

const hydrate = (state: State1870) => Definition.runtime.hydrator.hydrateState(state)

describe('the $400 finish (p. 24)', () => {
    function atPrice(price: number, machineState: string, config?: Record<string, boolean>) {
        const game = prepared(
            (state) => {
                operated(state, 'IC', state.players[0].playerId)
                const space = Market1870.spaces.find((entry) => entry.price === price)
                assertExists(space, `No $${price} space`)
                placeStockMarker(state.stockMarket, 'IC', space.id)
                state.machineState = machineState
            },
            4,
            config
        )
        return game.state
    }

    it('ends the game once a company at $400 has finished operating', () => {
        const trigger = (state: State1870) => EndingRules1870.trigger(state)
        const finish = { finish400: true }
        expect(trigger(atPrice(400, 'OperatingSet', finish))?.reason).toBe('$400 share price')
        expect(trigger(atPrice(400, 'StartingOperatingSet', finish))?.reason).toBe(
            '$400 share price'
        )
        expect(trigger(atPrice(400, 'DistributingEarnings', finish))).toBeUndefined()
    })

    it('needs the variant, and the price', () => {
        const trigger = (state: State1870) => EndingRules1870.trigger(state)
        expect(trigger(atPrice(400, 'OperatingSet'))).toBeUndefined()
        expect(trigger(atPrice(375, 'OperatingSet', { finish400: true }))).toBeUndefined()
    })
})

describe('1830 diesels (p. 24)', () => {
    const depot = (config?: Record<string, boolean>) =>
        table(4, 7, config).initialState.trainInventory.trains.map((train) => train.definitionId)

    it('takes out the 8s and 10s', () => {
        expect(depot()).toEqual(expect.arrayContaining(['8', '10']))
        const diesels = depot({ diesels: true })
        expect(diesels).not.toContain('8')
        expect(diesels).not.toContain('10')
    })

    function inPhase(phaseId: string, config?: Record<string, boolean>) {
        return prepared(
            (state) => {
                state.phaseId = phaseId
                operated(state, 'IC', state.players[0].playerId)
                giveTrain(state, 'IC', '4')
                state.trainInventory.trains = state.trainInventory.trains.filter(
                    (train) =>
                        train.status !== 'depot' ||
                        !['2', '3', '4', '5'].includes(train.definitionId)
                )
            },
            4,
            config
        ).state
    }

    it('goes on sale with the first 6, beside the next train and never beside a 12', () => {
        const before = TrainRules1870.availableDefinitions(inPhase('5', { diesels: true }))
        expect(before).toEqual(['6'])
        const after = TrainRules1870.availableDefinitions(inPhase('6', { diesels: true }))
        expect(after).toEqual(['6', 'D'])
        expect(TrainRules1870.availableDefinitions(inPhase('6'))).toEqual(['6'])
    })

    it('scraps the 4s with the first diesel and never the 5s', () => {
        const rust = (phaseId: string, definitionId: string) => {
            const state = inPhase(phaseId, { diesels: true })
            return PhaseRules1870.rustTiming(state, {
                ...state.trainInventory.trains[0],
                definitionId
            })
        }
        expect(rust('6', '4')).toBeUndefined()
        expect(rust('D', '4')).toBe('immediate')
        expect(rust('D', '5')).toBeUndefined()
    })

    it('counts a game ending on the 12 or the diesel as finished', () => {
        expect(Phases1870.share('2')).toBe(0)
        expect(Phases1870.share('12')).toBe(1)
        expect(Phases1870.share('D')).toBe(1)
        expect(Phases1870.share('6')).toBeCloseTo(4 / 7)
    })

    it('costs $800 trading in a 4, 5 or 6, not a 3', () => {
        const state = inPhase('6', { diesels: true })
        const train = (definitionId: string) => ({
            ...state.trainInventory.trains[0],
            definitionId
        })
        const price = (definitionId: string) =>
            TrainRules1870.exchangePrice?.(state, 'IC', 'D', train(definitionId))
        expect(price('4')).toBe(800)
        expect(price('5')).toBe(800)
        expect(price('6')).toBe(800)
        expect(price('3')).toBeUndefined()
        expect(TrainRules1870.exchangePrice?.(inPhase('6'), 'IC', 'D', train('4'))).toBeUndefined()
    })
})

describe('Station Marker Wars (p. 25)', () => {
    const Dallas: RevenueCenter = { locationId: 'J5', nodeId: 'city' }
    const station = (state: State1870) =>
        state.stations.find((entry) => entry.id === destinationStationId('IC'))
    const beside = (state: State1870) =>
        (state.stationAccess ?? []).filter((entry) => entry.sourceId === DestinationStationSource)
    const TwoSpaces = [{ locationId: 'J5', definitionId: '18xx:14', rotation: 0 }] as const

    function dallas(config?: Record<string, boolean>, spaces = true) {
        const game = prepared(
            (state) => {
                operated(state, 'TP', state.players[0].playerId)
                if (spaces) state.tileInventory = TileSet1870.createInventory(TwoSpaces)
            },
            4,
            config
        )
        return hydrate(game.state)
    }

    it('takes an open space in Dallas with the variant', () => {
        const state = dallas({ stationWars: true })
        placeWarStation(state, 'IC', Dallas)
        expect(station(state)?.status).toBe('placed')
        expect(beside(state)).toEqual([])
    })

    it('stays beside the city without the variant', () => {
        const state = dallas()
        placeWarStation(state, 'IC', Dallas)
        expect(station(state)?.status).not.toBe('placed')
        expect(beside(state)).toHaveLength(1)
    })

    it('stays beside a full city until an upgrade opens a space', () => {
        const state = dallas({ stationWars: true }, false)
        placeWarStation(state, 'IC', Dallas)
        expect(station(state)?.status).not.toBe('placed')
        expect(beside(state)).toHaveLength(1)
        state.tileInventory = TileSet1870.createInventory(TwoSpaces)
        stationWarsAfterLay(state, 'J5')
        expect(station(state)?.status).toBe('placed')
        expect(beside(state)).toEqual([])
    })
})
