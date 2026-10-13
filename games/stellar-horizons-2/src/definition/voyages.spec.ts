import { describe, expect, it } from 'vitest'
import type { Game } from '@tabletop/common'
import { ScenarioId } from '../components/scenarios.js'
import { isEarthlikeClass, worldTile } from '../components/worlds.js'
import type { StellarHorizonsProjectedState } from '../model/gameState.js'
import { capabilitiesOf } from '../model/fleet.js'
import {
    MASTER_SEED,
    VOYAGES_CONFIG,
    createGame,
    engine,
    execute,
    finishDecade,
    hydrate,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { MachineState } from './states.js'

const AROUND_SOL = ['alpha-centauri', 'barnards-star', 'luhman-16', 'wise-0855-0714']
const STARTING_SYSTEMS = ['barnards-star', 'luhman-16', 'alpha-centauri']

function placeBases(game: Game, state: StellarHorizonsProjectedState, systemIds: string[]) {
    return systemIds.reduce((current, systemId) => {
        const [playerId] = current.activePlayerIds
        return execute(
            game,
            current,
            userAction(game, playerId, ActionType.PlaceStartingBase, { systemId })
        )
    }, state)
}

describe('These are the Voyages setup', () => {
    it('lays out six sectors in 2250 with the systems next to Sol already surveyed', () => {
        const { state } = startedGame(2, VOYAGES_CONFIG)
        expect(state.scenario).toBe(ScenarioId.Voyages)
        expect(state.year).toBe(2250)
        expect(state.systems).toHaveLength(27)
        for (const system of state.systems) {
            const surveyed = system.systemId === 'sol' || AROUND_SOL.includes(system.systemId)
            expect(system.explorationMarker).toBe(surveyed ? 0 : 5)
            expect(system.worlds.length > 0).toBe(AROUND_SOL.includes(system.systemId))
        }
        const worldCounts = AROUND_SOL.map(
            (systemId) => hydrate(state).systemState(systemId).worlds.length
        )
        expect(worldCounts).toEqual([3, 2, 2, 2])
        expect(state.worldPool).toHaveLength(160 - 9)
    })

    it('never starts WISE 0855-0714 with an M or O world', () => {
        for (const seed of ['1', '2', '3', '4', '5', '6', '7', '8']) {
            const game = createGame(2, VOYAGES_CONFIG)
            const { initialState } = engine.startGame(game, {
                masterSeed: MASTER_SEED.slice(1) + seed
            })
            const wise = hydrate(initialState).systemState('wise-0855-0714')
            for (const world of wise.worlds) {
                expect(isEarthlikeClass(worldTile(world.tileId).worldClass)).toBe(false)
            }
        }
    })

    it('gives each player $25B, one marker of each type and every level 3 tech', () => {
        const { state } = startedGame(3, VOYAGES_CONFIG)
        for (const player of state.players) {
            expect(player.cash).toBe(25)
            expect(player.techMarkers.Biology).toHaveLength(1)
            expect(player.techMarkers.Physics).toHaveLength(1)
            expect(player.techMarkers.Engineering).toHaveLength(1)
            expect(player.techs).toHaveLength(23)
            expect(player.anomalies).toEqual([])
        }
    })

    it('needs at least two players', () => {
        const game = createGame(1, VOYAGES_CONFIG)
        expect(() => engine.startGame(game, { masterSeed: MASTER_SEED })).toThrow(
            'These are the Voyages needs at least 2 players'
        )
    })

    it('rejects a scenario that does not exist', () => {
        expect(() =>
            Definition.info.configurator?.validateConfig({ scenario: 'A New Earth' })
        ).toThrow()
    })
})

describe('These are the Voyages starting bases', () => {
    it('are placed in reverse initiative order before the first decade', () => {
        const { game, state } = startedGame(3, VOYAGES_CONFIG)
        const order = state.turnManager.turnOrder
        expect(state.machineState).toBe(MachineState.PlacingStartingBases)
        expect(state.activePlayerIds).toEqual([order[2]])

        const afterFirst = placeBases(game, state, ['luhman-16'])
        expect(afterFirst.activePlayerIds).toEqual([order[1]])

        const placed = placeBases(game, afterFirst, ['luhman-16', 'alpha-centauri'])
        expect(placed.machineState).toBe(MachineState.Building)
        const hydrated = hydrate(placed)
        expect(hydrated.basesOf(order[2])).toEqual([
            { playerId: order[2], systemId: 'luhman-16', settlements: 25, spent: 0, cloned: false }
        ])
        expect(hydrated.basesOf(order[1])).toEqual([
            { playerId: order[1], systemId: 'luhman-16', settlements: 25, spent: 0, cloned: false }
        ])
        expect(hydrated.basesOf(order[0])).toEqual([
            {
                playerId: order[0],
                systemId: 'alpha-centauri',
                settlements: 25,
                spent: 0,
                cloned: false
            }
        ])
    })

    it('can only go to Barnard’s Star, Luhman 16 or Alpha Centauri', () => {
        const { game, state } = startedGame(2, VOYAGES_CONFIG)
        expect(() => placeBases(game, state, ['wise-0855-0714'])).toThrow()
        expect(() => placeBases(game, state, ['sirius'])).toThrow()
    })

    it('are not part of Footfall', () => {
        const { game, state } = startedGame(2)
        expect(state.machineState).toBe(MachineState.Building)
        expect(() => placeBases(game, state, ['alpha-centauri'])).toThrow()
    })
})

describe('These are the Voyages decades', () => {
    it('pay $5B at the start of each even decade and never terraform', () => {
        const { game, state: started } = startedGame(2, VOYAGES_CONFIG)
        const placed = placeBases(game, started, STARTING_SYSTEMS.slice(0, 2))
        const [first] = placed.turnManager.turnOrder
        expect(capabilitiesOf(hydrate(placed), first).terraforms).toBe(0)

        const in2260 = finishDecade(game, placed)
        expect(in2260.year).toBe(2260)
        expect(in2260.players.map((player) => player.cash)).toEqual([30, 30])

        const in2270 = finishDecade(game, in2260)
        expect(in2270.year).toBe(2270)
        expect(in2270.machineState).toBe(MachineState.Building)
        expect(in2270.players.map((player) => player.cash)).toEqual([30, 30])
    })

    it('reach systems two away from Sol or from a starting base', () => {
        const { state } = startedGame(2, VOYAGES_CONFIG)
        const [first] = state.turnManager.turnOrder
        const capabilities = capabilitiesOf(hydrate(state), first)
        expect(capabilities.cvRange).toBe(2)
        expect(capabilities.cvMaxSize).toBe(5)
        expect(capabilities.settleHabitability).toBe(40)
    })
})
