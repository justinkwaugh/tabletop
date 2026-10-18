import { describe, expect, it } from 'vitest'
import { ANOMALIES, AnomalyChallenge } from '../components/anomalies.js'
import { TechId } from '../components/techs.js'
import { VOYAGES_CONFIG, hydrate, placeBase, placeShip, startedGame } from '../testing/fixtures.js'
import { anomalyDifficulty, searchForAnomaly } from './anomalies.js'
import { cloningBases } from './building.js'
import { canExplore } from './exploration.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { canSettleSystem } from './settling.js'
import { resolveNextSurvey } from './surveys.js'

const NO_EXPLORATION_AND_NO_BASES = 'pirate-lair'
const NO_BASES_ONLY = 'terran-dna'
const UNRESTRICTED = 'stellar-chart'

function voyages(playerCount = 2): HydratedStellarHorizonsGameState {
    return hydrate(startedGame(playerCount, VOYAGES_CONFIG).state)
}

function placeFirstPlayerShip(
    state: HydratedStellarHorizonsGameState,
    shipId: string,
    systemId: string
) {
    const [playerId] = state.initiativeOrder()
    return placeShip(state, playerId, shipId, systemId)
}

describe('anomaly tiles', () => {
    it('are 19 science and 15 combat challenges', () => {
        const count = (challenge: AnomalyChallenge) =>
            ANOMALIES.filter((anomaly) => anomaly.challenge === challenge).length
        expect(count(AnomalyChallenge.Science)).toBe(19)
        expect(count(AnomalyChallenge.Combat)).toBe(15)
        expect(new Set(ANOMALIES.map((anomaly) => anomaly.id)).size).toBe(34)
    })

    it('are as hard as their printed value plus the number of players', () => {
        expect(anomalyDifficulty(voyages(2), 'terran-dna')).toBe(10)
        expect(anomalyDifficulty(voyages(4), 'alien-sentinel')).toBe(19)
    })
})

describe('finding anomalies', () => {
    it('places one on a roll of 20 or less and nothing above that', () => {
        const state = voyages()
        const systemIds = state.systems
            .filter((system) => system.explorationMarker > 0)
            .map((system) => system.systemId)
        let found = 0
        for (const systemId of systemIds) {
            const before = state.anomalyPool.length
            const search = searchForAnomaly(state, systemId, state.initiativeOrder()[0])
            expect(search?.roll).toBeGreaterThanOrEqual(1)
            expect(search?.roll).toBeLessThanOrEqual(100)
            if ((search?.roll ?? 100) <= 20) {
                found += 1
                expect(state.systemState(systemId).anomaly).toBe(search?.anomalyId)
                expect(state.anomalyPool).toHaveLength(before - 1)
                expect(state.anomalyPool).not.toContain(search?.anomalyId)
            } else {
                expect(search?.anomalyId).toBeUndefined()
                expect(state.systemState(systemId).anomaly).toBeUndefined()
                expect(state.anomalyPool).toHaveLength(before)
            }
        }
        expect(state.anomalyPool).toHaveLength(34 - found)
    })

    it('finds roughly one in five', () => {
        const state = voyages()
        let found = 0
        for (let search = 0; search < 1000; search++) {
            state.anomalyPool = ANOMALIES.map((anomaly) => anomaly.id)
            state.systemState('vega').anomaly = undefined
            if (searchForAnomaly(state, 'vega', state.initiativeOrder()[0])?.anomalyId) {
                found += 1
            }
        }
        expect(found).toBeGreaterThan(160)
        expect(found).toBeLessThan(240)
    })

    it('never adds a second anomaly to a system or draws from an empty pool', () => {
        const state = voyages()
        state.systemState('vega').anomaly = UNRESTRICTED
        for (let search = 0; search < 100; search++) {
            expect(
                searchForAnomaly(state, 'vega', state.initiativeOrder()[0])?.anomalyId
            ).toBeUndefined()
        }
        expect(state.systemState('vega').anomaly).toBe(UNRESTRICTED)

        state.anomalyPool = []
        for (let search = 0; search < 100; search++) {
            expect(
                searchForAnomaly(state, 'altair', state.initiativeOrder()[0])?.anomalyId
            ).toBeUndefined()
        }
    })

    it('can find a new one once the first has been taken away', () => {
        const state = voyages()
        state.systemState('vega').anomaly = undefined
        const found = Array.from({ length: 200 }, () => {
            const search = searchForAnomaly(state, 'vega', state.initiativeOrder()[0])
            state.systemState('vega').anomaly = undefined
            return search?.anomalyId
        }).filter((anomalyId) => anomalyId !== undefined)
        expect(found.length).toBeGreaterThan(1)
    })

    it('rolls when a survey is completed, and only then', () => {
        const state = voyages()
        const [playerId] = state.initiativeOrder()
        state.getPlayerState(playerId).pendingSurveys.push({ shipId: 'ship', systemId: 'vega' })
        const completed = resolveNextSurvey(state)
        expect(completed.completed).toBe(true)
        expect(completed.anomaly?.roll).toBeGreaterThanOrEqual(1)

        state.systemState('altair').explorationMarker = 0
        state.getPlayerState(playerId).pendingSurveys.push({ shipId: 'ship', systemId: 'altair' })
        const wasted = resolveNextSurvey(state)
        expect(wasted.completed).toBe(false)
        expect(wasted.anomaly).toBeUndefined()
    })

    it('is not part of Footfall', () => {
        const state = hydrate(startedGame(2).state)
        expect(state.anomalyPool).toEqual([])
        expect(searchForAnomaly(state, 'sirius', state.initiativeOrder()[0])).toBeUndefined()
    })
})

describe('restrictive anomalies', () => {
    it('stop exploration where the tile shows no exploration', () => {
        const state = voyages()
        const ship = placeFirstPlayerShip(state, 'starfarers-kepler', 'vega')
        expect(canExplore(state, ship)).toBe(true)

        state.systemState('vega').anomaly = NO_BASES_ONLY
        expect(canExplore(state, ship)).toBe(true)

        state.systemState('vega').anomaly = NO_EXPLORATION_AND_NO_BASES
        expect(canExplore(state, ship)).toBe(false)
    })

    it('stop settling and cloning where the tile shows no bases', () => {
        const state = voyages()
        const [playerId] = state.initiativeOrder()
        expect(canSettleSystem(state, playerId, 'alpha-centauri')).toBe(true)

        state.systemState('alpha-centauri').anomaly = UNRESTRICTED
        expect(canSettleSystem(state, playerId, 'alpha-centauri')).toBe(true)

        state.systemState('alpha-centauri').anomaly = NO_BASES_ONLY
        expect(canSettleSystem(state, playerId, 'alpha-centauri')).toBe(false)
    })

    it('stop cloning at a base under a no-bases anomaly', () => {
        const state = voyages()
        const [playerId] = state.initiativeOrder()
        const player = state.getPlayerState(playerId)
        player.techs.push({ techId: TechId.Cloning, year: 2240 })
        placeBase(state, playerId, 'alpha-centauri', 25)
        expect(cloningBases(state, playerId)).toEqual(['alpha-centauri'])

        state.systemState('alpha-centauri').anomaly = NO_BASES_ONLY
        expect(cloningBases(state, playerId)).toEqual([])
    })
})
