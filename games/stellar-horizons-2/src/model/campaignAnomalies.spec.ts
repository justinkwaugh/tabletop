import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import { HydratedResolveAnomaly } from '../actions/resolveAnomaly.js'
import { AnomalyBackKind } from '../components/anomalies.js'
import { ScenarioId } from '../components/scenarios.js'
import { TechField } from '../components/techFields.js'
import { WorldSide } from '../components/worlds.js'
import { ActionType } from '../definition/actions.js'
import { baseEffects, blocksBases, systemAnomaly } from './anomalies.js'
import { buildCost } from './building.js'
import {
    migrationChance,
    produceAtBases,
    productionYield,
    systemPopulationLimit
} from './economy.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { CASH_PRODUCTION } from './pieces.js'
import {
    isValidRewardPlacement,
    placeRewardSettlements,
    rewardPlacementSystems
} from './settlementRewards.js'
import { hydrate, placeBase, startedGame } from '../testing/fixtures.js'

const SYSTEM = 'alpha-centauri'

function campaign(): HydratedStellarHorizonsGameState {
    const state = hydrate(startedGame(3, { scenario: ScenarioId.Campaign }).state)
    // m-1 may have been set aside for terraforming; take it from wherever it is.
    for (const pool of [state.worldPool, state.setAsideWorlds]) {
        if (pool.includes('m-1')) pool.splice(pool.indexOf('m-1'), 1)
    }
    state.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
    return state
}

function placeAnomaly(state: HydratedStellarHorizonsGameState, anomalyId: string) {
    state.anomalyPool.splice(state.anomalyPool.indexOf(anomalyId), 1)
    state.systemState(SYSTEM).anomaly = anomalyId
}

function resolve(state: HydratedStellarHorizonsGameState, playerId: string, anomalyId: string) {
    state.getPlayerState(playerId).anomalyAttempts.push({
        systemId: SYSTEM,
        anomalyId,
        shipIds: []
    })
    const action = new HydratedResolveAnomaly({
        id: `resolve-${anomalyId}`,
        gameId: state.gameId,
        source: ActionSource.System,
        type: ActionType.ResolveAnomaly
    })
    action.apply(state)
    assertExists(action.metadata)
    return action.metadata
}

describe('Resolving an anomaly in the campaign', () => {
    it('pays the front’s reward and leaves a tile with a back for bases in the system', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        placeAnomaly(state, 'terran-dna')
        expect(blocksBases(state, SYSTEM)).toBe(true)
        const before = state.getPlayerState(playerId)
        const influence = before.influence
        const markers = before.techMarkers.Biology.length
        const metadata = resolve(state, playerId, 'terran-dna')
        expect(metadata.reward?.influence).toBe(2)
        expect(metadata.turnedOver?.back).toBe(AnomalyBackKind.Bases)
        const player = state.getPlayerState(playerId)
        expect(player.influence).toBe(influence + 2)
        expect(player.techMarkers.Biology.length).toBe(markers + 2)
        // Turned over: no longer a challenge, no longer blocking bases, still in the system.
        expect(systemAnomaly(state, SYSTEM)).toBeUndefined()
        expect(blocksBases(state, SYSTEM)).toBe(false)
        expect(state.systemState(SYSTEM).anomaly).toBe('terran-dna')
        expect(baseEffects(state, SYSTEM).markerProduction?.fields).toEqual([TechField.Biology])
    })

    it('removes a tile whose back says so, and notes rewards not in the game yet', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        placeAnomaly(state, 'alien-derelict')
        expect(resolve(state, playerId, 'alien-derelict').reward?.notYet).toEqual([
            'a level I Fleet card'
        ])
        placeAnomaly(state, 'violent-separatists')
        state.systemState(SYSTEM).anomalyResolved = undefined
        resolve(state, playerId, 'violent-separatists')
        expect(state.systemState(SYSTEM).anomaly).toBeUndefined()
    })

    it('draws a world for the Stellar Chart’s system and each neighbour with an empty slot', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        placeAnomaly(state, 'stellar-chart')
        const metadata = resolve(state, playerId, 'stellar-chart')
        expect(metadata.turnedOver?.back).toBe(AnomalyBackKind.StellarChart)
        expect(metadata.turnedOver?.worlds.map((world) => world.systemId)).toContain(SYSTEM)
        expect(state.systemState(SYSTEM).worlds).toHaveLength(2)
        expect(state.systemState(SYSTEM).anomaly).toBeUndefined()
    })

    it('has settlement rewards placed at the Player’s bases or as a new base in the system', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        placeBase(state, playerId, 'barnards-star', 2)
        placeAnomaly(state, 'splinter-colony')
        resolve(state, playerId, 'splinter-colony')
        expect(state.settlementReward).toEqual({ playerId, systemId: SYSTEM, settlements: 2 })
        // The Starfarers may hold two bases in 2100, so a new base at Alpha Centauri is allowed.
        expect(rewardPlacementSystems(state)).toEqual(['barnards-star', SYSTEM])
        const placements = [
            { systemId: 'barnards-star', settlements: 1 },
            { systemId: SYSTEM, settlements: 1 }
        ]
        expect(isValidRewardPlacement(state, [{ systemId: SYSTEM, settlements: 1 }])).toBe(false)
        expect(isValidRewardPlacement(state, placements)).toBe(true)
        placeRewardSettlements(state, placements)
        expect(state.base(playerId, 'barnards-star')?.settlements).toBe(3)
        expect(state.base(playerId, SYSTEM)?.settlements).toBe(1)
        expect(state.settlementReward).toBeUndefined()
    })
})

describe('The backs of resolved anomalies', () => {
    function withBack(anomalyId: string) {
        const state = campaign()
        state.systemState(SYSTEM).anomaly = anomalyId
        state.systemState(SYSTEM).anomalyResolved = true
        const [playerId] = state.initiativeOrder()
        return { state, playerId }
    }

    it('add their production bonus only to the matching product', () => {
        const { state, playerId } = withBack('alien-derelict')
        const base = placeBase(state, playerId, SYSTEM, 3)
        // m-1 side I: cash 4, biology 2; no settlement bonus below 5.
        expect(productionYield(state, base, CASH_PRODUCTION)).toBe(4)
        expect(productionYield(state, base, TechField.Biology)).toBe(2)
        expect(productionYield(state, base, TechField.Physics)).toBe(1)
        expect(productionYield(state, base, TechField.Engineering)).toBe(1)
    })

    it('double the settlements counted for the production bonus (Natural Stimulants)', () => {
        const { state, playerId } = withBack('natural-stimulants')
        const base = placeBase(state, playerId, SYSTEM, 5)
        // 5 settlements count as 10: +$2B instead of +$1B.
        expect(productionYield(state, base, CASH_PRODUCTION)).toBe(4 + 2)
    })

    it('take a settlement in production (Hostile Xenomorphs) or add one after it (Symbiotic Spores)', () => {
        const xenomorphs = withBack('hostile-xenomorphs')
        placeBase(xenomorphs.state, xenomorphs.playerId, SYSTEM, 4).production = CASH_PRODUCTION
        produceAtBases(xenomorphs.state)
        expect(xenomorphs.state.base(xenomorphs.playerId, SYSTEM)?.settlements).toBe(3)
        const spores = withBack('symbiotic-spores')
        placeBase(spores.state, spores.playerId, SYSTEM, 40).production = CASH_PRODUCTION
        produceAtBases(spores.state)
        expect(spores.state.base(spores.playerId, SYSTEM)?.settlements).toBe(41)
    })

    it('raise the population limit, migration and build costs as printed', () => {
        const tunnels = withBack('tunnel-complex')
        expect(systemPopulationLimit(tunnels.state, tunnels.playerId, SYSTEM)).toBe(25 + 5)
        const dissidents = withBack('dissidents')
        placeBase(dissidents.state, dissidents.playerId, SYSTEM, 3)
        expect(migrationChance(dissidents.state, dissidents.playerId, SYSTEM, 0)).toBe(100)
        const nanobots = withBack('nanobot-swarm')
        expect(buildCost(nanobots.state, 'starfarers-kepler', SYSTEM)).toBe(
            buildCost(nanobots.state, 'starfarers-kepler', 'sol') - 1
        )
    })
})
