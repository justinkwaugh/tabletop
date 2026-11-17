import { PlayerStatus, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { boardMap } from '../data/boardMaps.js'
import { MAP_IDS, type MapId } from '../data/maps.js'
import { USA_CITIES } from '../data/usaMap.js'
import { CURRENT_RIDE_THE_RAILS_REVISION } from '../model/gameState.js'
import { engine, fixturePlayerIds, freshState, masterSeed } from '../testing/fixtures.js'
import { Definition } from './definition.js'
import { PhaseName } from './phases.js'
import { RideTheRailsRuntime } from './runtime.js'
import { MachineState } from './states.js'

// R-1.3.2: the passengers each map takes at setup, one per city but those it leaves empty.
const SETUP_PASSENGERS: Readonly<Record<MapId, number>> = {
    'map.usa': 51,
    'map.au': 52,
    'map.ca': 52,
    'map.fr': 52,
    'map.de': 52
}

function gameFor(playerCount: number): Game {
    return RideTheRailsRuntime.initializer.initializeGame(
        {
            id: 'ride-the-rails-setup',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config: {},
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `seat${index + 1}`,
                name: `Seat ${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function seedFor(index: number): string {
    return index.toString(16).padStart(32, '0')
}

describe('initialization', () => {
    it('records the revision the game was created under (R-X.3)', () => {
        expect(CURRENT_RIDE_THE_RAILS_REVISION).toBe(1)
        expect(freshState().rideTheRailsRevision).toBe(CURRENT_RIDE_THE_RAILS_REVISION)
    })

    it('plays the USA map when the game names none, as every game stored before the map option (R-8, R-X.3)', () => {
        expect(freshState().mapId).toBe('map.usa')
    })

    it('puts one passenger on every city, in id order (R-1.3.2)', () => {
        const { passengers } = freshState()
        expect(passengers).toHaveLength(51)
        expect(new Set(passengers)).toEqual(new Set(USA_CITIES.map((city) => city.id)))
        expect(passengers).toEqual([...passengers].sort())
    })

    it('gives every player $0 and no shares (R-1.3.6, R-2.4)', () => {
        for (const player of freshState(5).players) {
            expect(player.money).toBe(0)
            expect(player.shares).toEqual({})
        }
    })

    it('opens round 1 with Take a Share (R-1.3.8, R-2.1)', () => {
        const state = freshState()
        expect(state.machineState).toBe(MachineState.TakingShares)
        expect(state.roundManager.currentRound?.number).toBe(1)
        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.TakeShare)
    })

    it('starts with an empty map and no bonus claimed (R-1.3)', () => {
        const state = freshState()
        expect(state.track).toEqual({})
        expect(state.transcontinental).toBeUndefined()
        expect(state.building).toBeUndefined()
    })

    it('keeps the turn order in the turn manager, the players in that order (R-1.3.7)', () => {
        const state = freshState(4)
        expect([...state.turnManager.turnOrder].sort()).toEqual(fixturePlayerIds(4))
        expect(state.players.map((player) => player.playerId)).toEqual(state.turnManager.turnOrder)
    })
})

describe.each(MAP_IDS)('setup on %s (R-1.3, R-8)', (mapId) => {
    it('plays the map the game was created on', () => {
        expect(freshState(3, mapId).mapId).toBe(mapId)
    })

    it('puts one passenger on every city but those the map leaves empty, in id order (R-1.3.2)', () => {
        const { passengers } = freshState(3, mapId)
        expect(passengers).toHaveLength(SETUP_PASSENGERS[mapId])
        expect(passengers).toEqual(boardMap(mapId).setupPassengerCityIds().toSorted())
        expect(new Set(passengers).size).toBe(passengers.length)
    })

    it('starts with an empty map and no bonus claimed (R-1.3)', () => {
        const state = freshState(3, mapId)
        expect(state.track).toEqual({})
        expect(state.transcontinental).toBeUndefined()
        expect(state.connectionClaim).toBeUndefined()
        expect(state.building).toBeUndefined()
    })

    describe.each([3, 4, 5])('for %i players (R-1.2, R-1.3)', (playerCount) => {
        const state = freshState(playerCount, mapId)

        it('seats every player', () => {
            expect(state.players).toHaveLength(playerCount)
            expect(state.turnManager.turnOrder).toHaveLength(playerCount)
        })

        it('puts the map’s passengers on it (R-1.3)', () => {
            expect(state.passengers).toHaveLength(SETUP_PASSENGERS[mapId])
        })

        it('gives every player $0 (R-1.3.6)', () => {
            expect(state.players.map((player) => player.money)).toEqual(
                Array.from({ length: playerCount }, () => 0)
            )
        })

        it('starts in round 1 (R-1.3.8)', () => {
            expect(state.roundManager.currentRound?.number).toBe(1)
        })

        it('gives the first turn to the last player in turn order, as Take a Share runs in reverse (R-2.2)', () => {
            const lastPlayerId = state.turnManager.turnOrder.at(-1)
            expect(state.turnManager.series).toHaveLength(1)
            expect(state.turnManager.currentTurn()?.playerId).toBe(lastPlayerId)
            expect(state.activePlayerIds).toEqual([lastPlayerId])
        })
    })
})

describe('player count (R-1.2)', () => {
    it.each([2, 6])('refuses a game of %i players', (playerCount) => {
        expect(() => engine.startGame(gameFor(playerCount), masterSeed)).toThrow(/3 to 5 players/)
    })

    it.each([3, 5])('accepts a game of %i players', (playerCount) => {
        expect(() => engine.startGame(gameFor(playerCount), masterSeed)).not.toThrow()
    })
})

describe('turn order (R-1.3.7, R-2.3)', () => {
    it('is the same for the same master seed', () => {
        // The state id is the platform's own, not drawn from the game's seed.
        const { id: _first, ...first } = engine.startGame(gameFor(5), masterSeed).initialState
        const { id: _second, ...second } = engine.startGame(gameFor(5), masterSeed).initialState
        expect(second).toEqual(first)
    })

    it('is drawn from the state PRNG, so master seeds give different orders', () => {
        const orders = new Set(
            Array.from({ length: 12 }, (_, index) =>
                engine
                    .startGame(gameFor(5), seedFor(index + 1))
                    .initialState.turnManager.turnOrder.join(',')
            )
        )
        expect(orders.size).toBeGreaterThan(1)
    })

    it('is drawn from the seed in a hosted game started without starting positions', () => {
        // A hosted start passes only the stored master seed (and any continuation).
        const seatOrder = gameFor(4).players.map((player) => player.id)
        const orders = Array.from(
            { length: 24 },
            (_, index) =>
                engine.startGame(gameFor(4), { masterSeed: seedFor(index + 1) }).initialState
                    .turnManager.turnOrder
        )
        expect(new Set(orders.map((order) => order.join(','))).size).toBeGreaterThan(8)
        expect(new Set(orders.map((order) => order[0]))).toEqual(new Set(seatOrder))
        expect(orders.filter((order) => order.join(',') === seatOrder.join(','))).not.toHaveLength(
            orders.length
        )
        for (const order of orders) expect([...order].sort()).toEqual([...seatOrder].sort())
    })

    it('follows an assigned starting order, and the last seat in it acts first (R-2.2)', () => {
        const playerIds = ['seat3', 'seat1', 'seat4', 'seat2']
        const { initialState } = engine.startGame(gameFor(4), {
            masterSeed,
            startingPositions: { playerIds }
        })
        expect(initialState.turnManager.turnOrder).toEqual(playerIds)
        expect(initialState.players.map((player) => player.playerId)).toEqual(playerIds)
        expect(initialState.activePlayerIds).toEqual(['seat2'])
    })
})
