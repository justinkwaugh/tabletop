import { describe, expect, it } from 'vitest'
import { Color, assertExists } from '@tabletop/common'
import { Faction } from '../components/factions.js'
import { TechField } from '../components/techFields.js'
import { STAR_MAP } from '../components/starMap.js'
import { TechId } from '../components/techs.js'
import { WorldSide, maxPopulation, worldTile } from '../components/worlds.js'
import { MachineState } from '../definition/states.js'
import { hydrate, startedGame } from '../testing/fixtures.js'
import { RepairMethod, buildLocations, canRepair, shipsAvailableToBuild } from './building.js'
import { capabilitiesOf, loseShip } from './fleet.js'
import { isTechAvailable, isValidTechPayment, techCost } from './development.js'
import { explorationValue, surveyThreshold } from './exploration.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { moveOptions } from './movement.js'
import { awardTechMarkers } from './pools.js'
import { canSettleSystem } from './settling.js'
import { applySurveyChoice, resolveNextSurvey } from './surveys.js'
import {
    applyTerraformChoice,
    replacementOptions,
    removalOptions,
    terraform
} from './terraforming.js'
import { TurnStep } from './turn.js'
import { victoriousPlayerIds } from './victory.js'

function freshState(playerCount = 2): HydratedStellarHorizonsGameState {
    return hydrate(startedGame(playerCount).state)
}

function placeShip(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    systemId: string
) {
    state.ships.push({
        shipId,
        playerId,
        systemId,
        transit: 0,
        damage: 0,
        settlements: 0,
        loadedFromBase: false,
        explored: false
    })
    return state.ship(shipId)
}

function factionPlayerId(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player, `No player chose ${faction}`)
    return player.playerId
}

function firstTile(state: HydratedStellarHorizonsGameState, predicate: (id: string) => boolean) {
    const tileId = state.worldPool.find(predicate)
    if (!tileId) {
        throw new Error('No matching tile in the pool')
    }
    state.worldPool.splice(state.worldPool.indexOf(tileId), 1)
    return tileId
}

describe('Footfall setup', () => {
    it('lays out the Sol and Alpha Centauri sectors with five-point exploration markers', () => {
        const state = freshState()
        expect(state.machineState).toBe(MachineState.PlayingTurn)
        expect(state.year).toBe(2150)
        expect(state.systems.map((system) => system.systemId).toSorted()).toEqual(
            [
                'alpha-centauri',
                'barnards-star',
                'gliese-876',
                'luhman-16',
                'procyon',
                'sirius',
                'sol',
                'v2306-ophiuchi',
                'wise-0855-0714'
            ].toSorted()
        )
        for (const system of state.systems) {
            expect(system.explorationMarker).toBe(system.systemId === 'sol' ? 0 : 5)
        }
    })

    it('gives each player $30B, one tech marker of each type and every level 1 tech', () => {
        const state = freshState(3)
        for (const player of state.players) {
            expect(player.cash).toBe(30)
            expect(player.techMarkers.Biology).toHaveLength(1)
            expect(player.techMarkers.Physics).toHaveLength(1)
            expect(player.techMarkers.Engineering).toHaveLength(1)
            expect(player.techs).toHaveLength(7)
            expect(player.step).toBe(TurnStep.Build)
        }
        const drawn = 3 * 3
        const pooled = Object.values(state.techPools).flat()
        expect(pooled.reduce((total, count) => total + count, 0)).toBe(3 * 65 - drawn)
    })

    it('colours each player by the faction they chose', () => {
        const state = freshState(2)
        const starfarers = state.players.find((player) => player.faction === Faction.Starfarers)
        expect(starfarers?.color).toBe(Color.Blue)
        expect(new Set(state.players.map((player) => player.color)).size).toBe(2)
    })
})

describe('level 1 capabilities', () => {
    it('match the first column of the tech chart', () => {
        const state = freshState()
        const capabilities = capabilitiesOf(state, state.players[0].playerId)
        expect(capabilities).toMatchObject({
            canBuySettlements: true,
            settleHabitability: 80,
            cvMovement: 4,
            reMovement: 2,
            cvRange: 1,
            reRange: 2,
            cvMaxSize: 3,
            cvMalfunction: 45,
            reMalfunction: 26,
            settlementCost: 5,
            terraforms: 0
        })
    })

    it('offers CV-2, CV-3 and RE counters of the player faction', () => {
        const state = freshState()
        const playerId = factionPlayerId(state, Faction.Starfarers)
        const sizes = new Set(shipsAvailableToBuild(state, playerId).map((ship) => ship.size))
        expect([...sizes].toSorted()).toEqual([0, 2, 3])
        expect(buildLocations(state, playerId, 'starfarers-discovery')).toEqual(['sol'])
    })
})

describe('movement', () => {
    it('times transfers by distance and movement modifier, fast ships one tech faster', () => {
        const state = freshState()
        const playerId = factionPlayerId(state, Faction.Starfarers)
        const discovery = placeShip(state, playerId, 'starfarers-discovery', 'sol')
        const pytheas = placeShip(state, playerId, 'starfarers-pytheas', 'sol')
        const kepler = placeShip(state, playerId, 'starfarers-kepler', 'sol')
        const turns = (ship: typeof discovery, systemId: string) =>
            moveOptions(state, ship).find((option) => option.systemId === systemId)?.turns

        expect(turns(discovery, 'alpha-centauri')).toBe(3)
        expect(turns(pytheas, 'alpha-centauri')).toBe(4)
        expect(turns(discovery, 'sirius')).toBeUndefined()
        expect(turns(kepler, 'sirius')).toBe(4)

        discovery.settlements = 1
        expect(turns(discovery, 'alpha-centauri')).toBe(4)
    })

    it('extends range from a base large enough to build the ship', () => {
        const state = freshState()
        const playerId = factionPlayerId(state, Faction.Starfarers)
        const pytheas = placeShip(state, playerId, 'starfarers-pytheas', 'alpha-centauri')
        expect(moveOptions(state, pytheas).map((option) => option.systemId)).not.toContain('sirius')
        state.bases.push({
            playerId,
            systemId: 'alpha-centauri',
            settlements: 9,
            spent: 0,
            cloned: false
        })
        expect(moveOptions(state, pytheas)).toContainEqual({ systemId: 'sirius', turns: 4 })
    })
})

describe('exploration and surveys', () => {
    it('pays $1B for each marker an empty pool cannot supply', () => {
        const state = freshState()
        const player = state.players[0]
        state.techPools[TechField.Physics] = [0, 0, 1, 0, 0]
        const before = { cash: player.cash, markers: player.techMarkers.Physics.length }

        const award = awardTechMarkers(state, player.playerId, TechField.Physics, 3)

        expect(award).toEqual({ markers: [3], cash: 2 })
        expect(player.techMarkers.Physics).toHaveLength(before.markers + 1)
        expect(player.cash).toBe(before.cash + 2)
    })

    it('compensates a lost ship in cash when the pools are empty', () => {
        const state = freshState()
        const playerId = factionPlayerId(state, Faction.Starfarers)
        const ship = placeShip(state, playerId, 'starfarers-andromeda', 'alpha-centauri')
        assertExists(ship, 'The ship was placed')
        state.techPools[TechField.Biology] = [0, 0, 0, 0, 0]
        state.techPools[TechField.Engineering] = [0, 0, 0, 0, 0]
        const cash = state.getPlayerState(playerId).cash

        const loss = loseShip(state, ship)

        expect(loss.compensation).toEqual({ Biology: [], Engineering: [], cash: 2 })
        expect(state.getPlayerState(playerId).cash).toBe(cash + 2)
    })

    it('sums marker, ship and system bonus', () => {
        const state = freshState()
        const playerId = factionPlayerId(state, Faction.Starfarers)
        const kepler = placeShip(state, playerId, 'starfarers-kepler', 'alpha-centauri')
        expect(explorationValue(state, kepler)).toBe(5 + 3 + 2)
        kepler.damage = 5
        expect(explorationValue(state, kepler)).toBe(5 + 1 + 2)
    })

    it('needs a larger single-exploration total with more players', () => {
        expect([1, 2, 3, 4].map(surveyThreshold)).toEqual([2, 3, 3, 4])
    })

    it('lowers the marker and fills an empty world slot on a completed survey', () => {
        const state = freshState()
        const [first] = state.initiativeOrder()
        state.pendingSurveys.push({ playerId: first, shipId: 'x', systemId: 'alpha-centauri' })
        const resolution = resolveNextSurvey(state)
        expect(resolution.completed).toBe(true)
        expect(state.systemState('alpha-centauri').explorationMarker).toBe(4)
        expect(state.systemState('alpha-centauri').worlds).toEqual([
            { tileId: resolution.drawnTileId, side: WorldSide.I }
        ])
    })

    it('resolves surveys in initiative order and stops once the marker is gone', () => {
        const state = freshState()
        const [first, second] = state.initiativeOrder()
        state.systemState('luhman-16').explorationMarker = 1
        state.pendingSurveys.push({ playerId: second, shipId: 'b', systemId: 'luhman-16' })
        state.pendingSurveys.push({ playerId: first, shipId: 'a', systemId: 'luhman-16' })
        expect(resolveNextSurvey(state)).toMatchObject({ playerId: first, completed: true })
        expect(resolveNextSurvey(state)).toMatchObject({ playerId: second, completed: false })
    })

    it('never places an M or O world in a restricted system', () => {
        const state = freshState()
        const [first] = state.initiativeOrder()
        for (let survey = 0; survey < 40; survey++) {
            const system = state.systemState('sirius')
            system.explorationMarker = 5
            system.worlds.forEach((world) => state.worldPool.push(world.tileId))
            system.worlds = []
            state.pendingSurveys.push({ playerId: first, shipId: 'x', systemId: 'sirius' })
            resolveNextSurvey(state)
            const placed = system.worlds[0]
            expect(['M', 'O']).not.toContain(worldTile(placed.tileId).worldClass)
        }
    })

    it('offers a better small world for a full system and removes a replaced No World', () => {
        const state = freshState()
        const [first] = state.initiativeOrder()
        const system = state.systemState('luhman-16')
        const noWorld = firstTile(state, (id) => worldTile(id).worldClass === 'None')
        const giant = firstTile(state, (id) => id.startsWith('m-'))
        system.worlds = [
            { tileId: noWorld, side: WorldSide.I },
            { tileId: giant, side: WorldSide.I }
        ]
        state.worldPool = state.worldPool.filter((id) => maxPopulation(id, WorldSide.I) === 10)
        state.pendingSurveys.push({ playerId: first, shipId: 'x', systemId: 'luhman-16' })
        const resolution = resolveNextSurvey(state)
        expect(resolution.awaitingChoice).toBe(true)
        expect(state.surveyChoice?.drawnTileId).toBe(resolution.drawnTileId)

        const replaced = applySurveyChoice(state, 0)
        expect(replaced?.tileId).toBe(noWorld)
        expect(state.removedWorlds).toEqual([noWorld])
        expect(system.worlds[0].tileId).toBe(resolution.drawnTileId)
    })
})

describe('tech development', () => {
    it('discounts by 3 per other owner at the start of the turn, to a minimum of 5', () => {
        const state = freshState(3)
        const [a, b, c] = state.initiativeOrder()
        expect(techCost(state, a, TechId.Terraforming)).toBe(10)
        state.getPlayerState(b).techs.push({ techId: TechId.Terraforming, year: 2140 })
        state.getPlayerState(c).techs.push({ techId: TechId.Terraforming, year: 2150 })
        expect(techCost(state, a, TechId.Terraforming)).toBe(7)
        state.getPlayerState(c).techs[7].year = 2140
        expect(techCost(state, a, TechId.Terraforming)).toBe(5)
    })

    it('requires prerequisites owned before this turn and one tech per field', () => {
        const state = freshState()
        const [a] = state.initiativeOrder()
        const player = state.getPlayerState(a)
        expect(isTechAvailable(state, a, TechId.Terraforming)).toBe(true)
        expect(isTechAvailable(state, a, TechId.ImprovedGeneticManipulation)).toBe(false)
        player.techs.push({ techId: TechId.ImprovedInterstellarSettlement, year: state.year })
        expect(isTechAvailable(state, a, TechId.AdvancedInterstellarSettlement)).toBe(false)
        player.fieldsDeveloped.push(TechField.Biology)
        expect(isTechAvailable(state, a, TechId.Terraforming)).toBe(false)
    })

    it('accepts markers plus cash without change, but no needless cash', () => {
        const state = freshState()
        const [a] = state.initiativeOrder()
        const player = state.getPlayerState(a)
        player.techMarkers.Biology = [4, 4, 3]
        expect(isValidTechPayment(state, a, TechId.Terraforming, [4, 4], 2)).toBe(true)
        expect(isValidTechPayment(state, a, TechId.Terraforming, [4, 4, 3], 0)).toBe(true)
        expect(isValidTechPayment(state, a, TechId.Terraforming, [4, 4, 3], 1)).toBe(false)
        expect(isValidTechPayment(state, a, TechId.Terraforming, [4, 4], 1)).toBe(false)
        expect(isValidTechPayment(state, a, TechId.Terraforming, [5, 5], 0)).toBe(false)
    })
})

describe('settling', () => {
    it('needs a revealed world and enough habitability tech', () => {
        const state = freshState()
        const [a] = state.initiativeOrder()
        expect(canSettleSystem(state, a, 'alpha-centauri')).toBe(false)
        const world = firstTile(state, (id) => worldTile(id).worldClass === 'K')
        state.systemState('alpha-centauri').worlds.push({ tileId: world, side: WorldSide.I })
        state.systemState('luhman-16').worlds.push({ tileId: world, side: WorldSide.I })
        expect(canSettleSystem(state, a, 'alpha-centauri')).toBe(true)
        expect(canSettleSystem(state, a, 'luhman-16')).toBe(false)
        expect(canSettleSystem(state, a, 'sol')).toBe(false)
    })
})

describe('terraforming', () => {
    it('flips an I-side world, then draws replacements no more than 10 larger', () => {
        const state = freshState()
        const [a] = state.initiativeOrder()
        state.getPlayerState(a).techs.push({ techId: TechId.Terraforming, year: 2140 })
        const polar = firstTile(state, (id) => worldTile(id).worldClass === 'P')
        state.systemState('alpha-centauri').worlds = [{ tileId: polar, side: WorldSide.I }]
        state.bases.push({
            playerId: a,
            systemId: 'alpha-centauri',
            settlements: 1,
            spent: 0,
            cloned: false
        })
        const target = { systemId: 'alpha-centauri', slot: 0 }
        expect(terraform(state, a, target)).toMatchObject({ flipped: true })
        const current = maxPopulation(polar, WorldSide.II)

        const better = firstTile(state, (id) => {
            const tile = worldTile(id)
            const population = maxPopulation(id, WorldSide.I)
            return tile.worldClass === 'L' && population > current && population <= current + 10
        })
        const worse = firstTile(state, (id) => worldTile(id).worldClass === 'None')
        state.worldPool = [better]
        const outcome = terraform(state, a, target)
        expect(outcome).toMatchObject({ flipped: false, awaitingChoice: true })
        const choice = state.terraformChoice
        assertExists(choice, 'Drawing a better world should offer a choice')
        expect(replacementOptions(state, choice)).toEqual([better])
        choice.drawnTileIds.push(worse)
        expect(removalOptions(state, choice)).toEqual([worse])
        applyTerraformChoice(state, better, [worse])
        expect(state.systemState('alpha-centauri').worlds[0]).toEqual({
            tileId: better,
            side: WorldSide.I
        })
        expect(state.worldPool).toContain(polar)
        expect(state.removedWorlds).toContain(worse)
    })
})

describe('victory', () => {
    it('needs ten settlements in a system whose printed population totals 25', () => {
        const state = freshState()
        const [a] = state.initiativeOrder()
        const small = firstTile(state, (id) => worldTile(id).worldClass === 'H')
        state.systemState('alpha-centauri').worlds = [{ tileId: small, side: WorldSide.I }]
        state.bases.push({
            playerId: a,
            systemId: 'alpha-centauri',
            settlements: 10,
            spent: 0,
            cloned: false
        })
        expect(victoriousPlayerIds(state)).toEqual([])
        const large = firstTile(state, (id) => worldTile(id).worldClass === 'L')
        state.systemState('alpha-centauri').worlds.push({ tileId: large, side: WorldSide.I })
        expect(victoriousPlayerIds(state)).toEqual([a])
    })
})

describe('repairs', () => {
    it('only repair whole damage points', () => {
        const state = freshState()
        const playerId = factionPlayerId(state, Faction.Starfarers)
        const ship = placeShip(state, playerId, 'starfarers-discovery', 'sol')
        ship.damage = 2
        expect(canRepair(state, playerId, ship.shipId, RepairMethod.Dock, 1.5)).toBe(false)
        expect(canRepair(state, playerId, ship.shipId, RepairMethod.Dock, 2)).toBe(true)
    })
})

describe('star map', () => {
    it('measures distance from Sol as printed on every system tile', () => {
        expect(STAR_MAP.distance('sol', 'alpha-centauri')).toBe(1)
        expect(STAR_MAP.distance('sol', 'sirius')).toBe(2)
        expect(STAR_MAP.distance('sol', '72-herculis')).toBe(5)
    })

    it('knows each system’s neighbours', () => {
        expect(STAR_MAP.adjacentSystemIds('sol').toSorted()).toEqual(
            [
                'alpha-centauri',
                'barnards-star',
                'lalande-21185',
                'luhman-16',
                'wise-0855-0714',
                'wolf-359'
            ].toSorted()
        )
        expect(STAR_MAP.adjacentSystemIds('18-scorpii')).toHaveLength(3)
    })
})
