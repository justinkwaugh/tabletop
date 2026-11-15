import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { placeStockMarker } from '@tabletop/18xx'
import { operated, prepared, table } from '../test/kit.js'
import { EndingRules1850, PhaseRules1850 } from './operating.js'
import type { State1850 } from './state.js'
import { Market1850 } from './stockMarket.js'
import { Phases1850, TrainRules1850 } from './trains.js'
import { Definition } from './definition/gameDefinition.js'

const hydrate = (state: State1850) => Definition.runtime.hydrator.hydrateState(state)

describe('the $400 finish (§16.1)', () => {
    function atPrice(price: number, machineState: string, config?: Record<string, boolean>) {
        const game = prepared(
            (state) => {
                operated(state, 'GN', state.players[0].playerId)
                const space = Market1850.spaces.find((entry) => entry.price === price)
                assertExists(space, `No $${price} space`)
                placeStockMarker(state.stockMarket, 'GN', space.id)
                state.machineState = machineState
            },
            4,
            config
        )
        return game.state
    }
    const trigger = (state: State1850) => EndingRules1850.trigger(state)

    it('ends the game once a company at $400 has finished operating', () => {
        const finish = { finish400: true }
        expect(trigger(atPrice(400, 'OperatingSet', finish))?.reason).toBe('$400 share price')
        expect(trigger(atPrice(400, 'DistributingEarnings', finish))).toBeUndefined()
    })

    it('needs the variant, and the price', () => {
        expect(trigger(atPrice(400, 'OperatingSet'))).toBeUndefined()
        expect(trigger(atPrice(375, 'OperatingSet', { finish400: true }))).toBeUndefined()
    })
})

describe('1830 diesels (§16.2)', () => {
    const depot = (config?: Record<string, boolean>) =>
        table(4, 7, config).initialState.trainInventory.trains.map((train) => train.definitionId)

    it('takes out the 8s and 10s', () => {
        expect(depot()).toEqual(expect.arrayContaining(['8', '10']))
        const diesels = depot({ diesels: true })
        expect(diesels).not.toContain('8')
        expect(diesels).not.toContain('10')
    })

    it('keeps the 5s permanent and rusts the 4s with the first diesel', () => {
        const game = prepared(
            (state) => {
                state.phaseId = 'D'
            },
            4,
            { diesels: true }
        )
        const rust = (definitionId: string) => {
            const train = game.state.trainInventory.trains.find(
                (entry) => entry.definitionId === definitionId
            )
            assertExists(train, `The depot has a ${definitionId}`)
            return PhaseRules1850.rustTiming(game.hydrated, train)
        }
        expect(rust('5')).toBeUndefined()
        expect(rust('4')).toBe('immediate')
    })

    it('sells diesels from the first 6-train', () => {
        const game = prepared(
            (state) => {
                state.phaseId = '6'
            },
            4,
            { diesels: true }
        )
        expect(TrainRules1850.availableDefinitions(hydrate(game.state))).toContain('D')
        expect(Phases1850.phase('D').tileColors).toContain('gray')
    })
})

describe('reduced tokens (§16.3)', () => {
    const stations = (companyId: string, config?: Record<string, boolean>) =>
        table(4, 7, config).initialState.stations.filter(
            (station) => station.companyId === companyId
        ).length

    it('takes a $100 token from the CB&Q and the Rock Island alone', () => {
        expect(stations('CBQ')).toBe(4)
        expect(stations('RI')).toBe(4)
        expect(stations('GN')).toBe(3)
        const reduced = { reducedTokens: true }
        expect(stations('CBQ', reduced)).toBe(3)
        expect(stations('RI', reduced)).toBe(3)
        expect(stations('GN', reduced)).toBe(3)
    })
})
