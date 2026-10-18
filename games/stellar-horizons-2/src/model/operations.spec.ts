import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { TechId } from '../components/techs.js'
import { WorldSide } from '../components/worlds.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import {
    canOperate,
    mine,
    pendingSyndicateTakes,
    research,
    settleSyndicateTakes
} from './operations.js'
import { MarkerReason, OperationKind } from './pieces.js'
import {
    nextShipTerraformer,
    queueShipTerraform,
    resolveNextShipTerraform,
    shipTerraformSlots
} from './terraforming.js'
import { hydrate, placeBase, placeShip, startedGame } from '../testing/fixtures.js'

const SYSTEM = 'alpha-centauri'

// Starfarers, Givers, Praetorians, True Path; the Syndicate is swapped in where needed.
function campaign(): HydratedStellarHorizonsGameState {
    const state = hydrate(startedGame(4, { scenario: ScenarioId.Campaign }).state)
    for (const pool of [state.worldPool, state.setAsideWorlds]) {
        if (pool.includes('m-1')) pool.splice(pool.indexOf('m-1'), 1)
    }
    state.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
    return state
}

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player)
    return player.playerId
}

describe('Mining and research', () => {
    it('need a capable ship in a system with a world and none of the Player’s bases', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        const pytheas = placeShip(state, starfarers, 'starfarers-pytheas', SYSTEM)
        expect(canOperate(state, pytheas, OperationKind.Mining)).toBe(true)
        expect(canOperate(state, pytheas, OperationKind.Research)).toBe(false)
        placeBase(state, starfarers, SYSTEM, 2)
        expect(canOperate(state, pytheas, OperationKind.Mining)).toBe(false)
    })

    it('mine $1B, or $2B on a die at or under the world’s cash value', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        const pytheas = placeShip(state, starfarers, 'starfarers-pytheas', SYSTEM)
        const cash = state.getPlayerState(starfarers).cash
        const result = mine(state, pytheas, 0)
        // m-1 side I has cash value 4.
        expect(result.target).toBe(4)
        expect(result.cash).toBe(result.roll <= 4 ? 2 : 1)
        expect(state.getPlayerState(starfarers).cash).toBe(cash + result.cash)
        expect(pytheas.explored).toBe(true)
    })

    it('research a marker of the world’s type on a die at or under its value plus half the ship’s', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        const orion = placeShip(state, starfarers, 'starfarers-orion', SYSTEM)
        const result = research(state, orion, 0)
        // m-1: biology 2; Orion explores 6, half is 3.
        expect(result.target).toBe(2 + 3)
        const earned = state.getPlayerState(starfarers).earnedMarkers
        expect(earned.map((entry) => entry.reason)).toEqual(
            result.success ? [MarkerReason.Research] : []
        )
    })

    it('allow one operation per system per Player each turn', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        const pytheas = placeShip(state, starfarers, 'starfarers-pytheas', SYSTEM)
        const polaris = placeShip(state, starfarers, 'starfarers-polaris', SYSTEM)
        mine(state, pytheas, 0)
        expect(canOperate(state, polaris, OperationKind.Mining)).toBe(false)
        const givers = playerOf(state, Faction.Givers)
        const darwin = placeShip(state, givers, 'givers-darwin', SYSTEM)
        expect(canOperate(state, darwin, OperationKind.Research)).toBe(true)
    })

    it('pay the Syndicate $1B where its ships outgun the Player’s', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        const syndicate = playerOf(state, Faction.TruePath)
        state.getPlayerState(syndicate).faction = Faction.Syndicate
        const pytheas = placeShip(state, starfarers, 'starfarers-pytheas', SYSTEM)
        placeShip(state, syndicate, 'syndicate-scavenger', SYSTEM)
        mine(state, pytheas, 0)
        expect(pendingSyndicateTakes(state)).toEqual([
            { fromPlayerId: starfarers, toPlayerId: syndicate, systemId: SYSTEM, cash: 1 }
        ])
        const before = state.getPlayerState(syndicate).cash
        settleSyndicateTakes(state)
        expect(state.getPlayerState(syndicate).cash).toBe(before + 1)
    })
})

describe('Terraforming with mining ships', () => {
    it('needs Atmosphere Processing, and resolves after the span with the usual IP', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        const pytheas = placeShip(state, starfarers, 'starfarers-pytheas', SYSTEM)
        expect(shipTerraformSlots(state, pytheas)).toEqual([])
        state.getPlayerState(starfarers).techs.push({
            techId: TechId.AtmosphereProcessing,
            year: 2090
        })
        expect(shipTerraformSlots(state, pytheas)).toEqual([0])
        queueShipTerraform(state, pytheas, 0)
        expect(pytheas.explored).toBe(true)
        expect(nextShipTerraformer(state)).toBe(starfarers)
        const influence = state.getPlayerState(starfarers).influence
        const resolved = resolveNextShipTerraform(state)
        expect(resolved?.outcome?.flipped).toBe(true)
        expect(state.systemState(SYSTEM).worlds[0].side).toBe(WorldSide.II)
        expect(state.getPlayerState(starfarers).influence).toBe(influence + 1)
        expect(nextShipTerraformer(state)).toBeUndefined()
    })
})
