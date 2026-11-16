import { GameState } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { buildState, freshState, type StateRecipe } from '../testing/fixtures.js'
import {
    CURRENT_RIDE_THE_RAILS_REVISION,
    HydratedRideTheRailsGameState,
    RideTheRailsGameStateValidator,
    type RideTheRailsGameState
} from './gameState.js'

const ROUND_ONE_TAKING_SHARES: StateRecipe = { playerCount: 4 }

const MID_BUILDING_YELLOW_STARTED: StateRecipe = {
    playerCount: 3,
    round: 3,
    phase: PhaseName.Build,
    currentPlayerId: 'p2',
    money: { p1: 7, p2: 12, p3: 4 },
    shares: {
        p1: { 'railroad.red': 2, 'railroad.orange': 1 },
        p2: { 'railroad.blue': 1, 'railroad.yellow': 2 },
        p3: { 'railroad.red': 1, 'railroad.blue': 1, 'railroad.orange': 1 }
    },
    track: {
        'hex.usa.6-60': ['railroad.red'],
        'hex.usa.9-55': ['railroad.blue'],
        'hex.usa.5-43': ['railroad.orange', 'railroad.yellow'],
        'hex.usa.8-38': ['railroad.orange'],
        'hex.usa.8-32': ['railroad.orange', 'railroad.yellow']
    },
    passengers: ['city.usa.seattle', 'city.usa.chicago', 'city.usa.boston', 'city.usa.denver'],
    building: { placed: 2, usedMountain: true }
}

const ROUND_SIX_RIDING: StateRecipe = {
    playerCount: 5,
    round: 6,
    phase: PhaseName.Ride,
    currentPlayerId: 'p4',
    money: { p1: 41, p2: 38, p3: 55, p4: 29, p5: 47 },
    shares: {
        p1: { 'railroad.red': 3, 'railroad.purple': 2, 'railroad.black': 1 },
        p2: { 'railroad.blue': 4, 'railroad.yellow': 2 },
        p3: { 'railroad.orange': 3, 'railroad.purple': 3 },
        p4: { 'railroad.yellow': 5, 'railroad.black': 1 },
        p5: { 'railroad.red': 1, 'railroad.blue': 2, 'railroad.orange': 3 }
    },
    track: {
        'hex.usa.0-4': ['railroad.purple'],
        'hex.usa.8-22': ['railroad.black', 'railroad.yellow'],
        'hex.usa.5-43': ['railroad.orange', 'railroad.yellow', 'railroad.black', 'railroad.red'],
        'hex.usa.6-60': ['railroad.blue']
    },
    passengers: ['city.usa.miami', 'city.usa.atlanta', 'city.usa.boise'],
    transcontinental: { playerId: 'p3', amount: 12 }
}

function roundTrip(state: HydratedRideTheRailsGameState): RideTheRailsGameState {
    return new HydratedRideTheRailsGameState(structuredClone(state.dehydrate())).dehydrate()
}

describe('state round trip', () => {
    it.each([
        ['a fresh state', () => freshState()],
        ['round 1, Take a Share', () => buildState(ROUND_ONE_TAKING_SHARES)],
        ['mid-building with Yellow started', () => buildState(MID_BUILDING_YELLOW_STARTED)],
        ['round 6, Ride the Rails', () => buildState(ROUND_SIX_RIDING)]
    ])('dehydrates and hydrates %s unchanged (R-X.3)', (_name, build) => {
        const state = build()
        const dehydrated = state.dehydrate()
        expect(roundTrip(state)).toEqual(dehydrated)
        expect(JSON.parse(JSON.stringify(dehydrated))).toEqual(dehydrated)
    })
})

describe('the fixture builder', () => {
    it('sets the round, phase, machine state and current player', () => {
        const state = buildState(MID_BUILDING_YELLOW_STARTED)
        expect(state.roundManager.currentRound?.number).toBe(3)
        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.Build)
        expect(state.machineState).toBe(MachineState.Building)
        expect(state.activePlayerIds).toEqual(['p2'])
        expect(state.turnManager.currentTurn()?.playerId).toBe('p2')
        expect(state.building).toEqual({ placed: 2, usedMountain: true })
    })

    it('starts Take a Share with the last player in turn order (R-2.2)', () => {
        const state = buildState({ playerCount: 4 })
        expect(state.turnManager.turnOrder).toEqual(['p1', 'p2', 'p3', 'p4'])
        expect(state.activePlayerIds).toEqual(['p4'])
    })

    it("sets a later round's turn order, and starts its phase with that order (R-2.5.1, R-2.2)", () => {
        const turnOrder = ['p3', 'p1', 'p2']
        const riding = buildState({ round: 3, phase: PhaseName.Ride, turnOrder })
        expect(riding.turnManager.turnOrder).toEqual(turnOrder)
        expect(riding.activePlayerIds).toEqual(['p3'])
        expect(buildState({ round: 3, turnOrder }).activePlayerIds).toEqual(['p2'])
        expect(() => buildState({ turnOrder: ['p1', 'p1', 'p2'] })).toThrow()
    })

    it('starts Ride the Rails with the first player in turn order (R-2.2)', () => {
        expect(buildState({ round: 2, phase: PhaseName.Ride }).activePlayerIds).toEqual(['p1'])
    })

    it('sets money and shares by player (R-2.4, R-3.1)', () => {
        const state = buildState(ROUND_SIX_RIDING)
        expect(state.getPlayerState('p3').money).toBe(55)
        expect(state.getPlayerState('p4').sharesOf('railroad.yellow')).toBe(5)
        expect(state.getPlayerState('p4').sharesOf('railroad.red')).toBe(0)
    })
})

describe('state shape', () => {
    it('keeps the railroads in each hex in placement order (R-3.2)', () => {
        const state = buildState(ROUND_SIX_RIDING)
        expect(roundTrip(state).track['hex.usa.5-43']).toEqual([
            'railroad.orange',
            'railroad.yellow',
            'railroad.black',
            'railroad.red'
        ])
    })

    it('keeps the passengers in city id order (R-3.3.6)', () => {
        expect(buildState(ROUND_SIX_RIDING).passengers).toEqual([
            'city.usa.atlanta',
            'city.usa.boise',
            'city.usa.miami'
        ])
    })

    it('stores no supply, availability, starts, East Coast holdings or $5 claims: they derive from track and shares', () => {
        const state = buildState(MID_BUILDING_YELLOW_STARTED).dehydrate()
        expect(Object.keys(state.players[0]).sort()).toEqual([
            'color',
            'money',
            'playerId',
            'shares'
        ])
        expect(
            Object.keys(state)
                .filter((key) => !(key in GameState.properties))
                .sort()
        ).toEqual([
            'building',
            'mapId',
            'passengers',
            'phaseManager',
            'rideTheRailsRevision',
            'roundManager',
            'track'
        ])
    })
})

describe('the canonical validator', () => {
    it.each([
        ['a fresh state', () => freshState()],
        ['round 1, Take a Share', () => buildState(ROUND_ONE_TAKING_SHARES)],
        ['mid-building with Yellow started', () => buildState(MID_BUILDING_YELLOW_STARTED)],
        ['round 6, Ride the Rails', () => buildState(ROUND_SIX_RIDING)]
    ])('accepts %s', (_name, build) => {
        expect(RideTheRailsGameStateValidator.Check(build().dehydrate())).toBe(true)
    })

    function withFirstPlayer(
        change: (player: RideTheRailsGameState['players'][number]) => void
    ): RideTheRailsGameState {
        const state = buildState(MID_BUILDING_YELLOW_STARTED).dehydrate()
        change(state.players[0])
        return state
    }

    it('rejects a share count below 0 (R-3.1)', () => {
        const state = withFirstPlayer((player) => {
            player.shares['railroad.red'] = -1
        })
        expect(RideTheRailsGameStateValidator.Check(state)).toBe(false)
    })

    it('rejects a share of a railroad that is not one (R-1.1)', () => {
        const state = buildState().dehydrate()
        const [player] = state.players
        expect(
            RideTheRailsGameStateValidator.Check({
                ...state,
                players: [{ ...player, shares: { 'railroad.green': 1 } }]
            })
        ).toBe(false)
    })

    it.each([-1, 2.5])('rejects money of %s (R-2.4)', (money) => {
        const state = withFirstPlayer((player) => {
            player.money = money
        })
        expect(RideTheRailsGameStateValidator.Check(state)).toBe(false)
    })

    it.each(['hex.usa.99-99', 'hex.usa.0-0', 'not-a-hex'])(
        'rejects track in %s, which is not a hex of the map (R-8.1)',
        (hexId) => {
            const state = buildState(MID_BUILDING_YELLOW_STARTED).dehydrate()
            expect(
                RideTheRailsGameStateValidator.Check({
                    ...state,
                    track: { ...state.track, [hexId]: ['railroad.red'] }
                })
            ).toBe(false)
        }
    )

    it('refuses to hydrate track in a hex that is not on the map (R-8.1)', () => {
        const state = buildState(MID_BUILDING_YELLOW_STARTED).dehydrate()
        expect(
            () =>
                new HydratedRideTheRailsGameState({
                    ...state,
                    track: { ...state.track, 'hex.usa.99-99': ['railroad.red'] }
                })
        ).toThrow()
    })

    it('R-X.3: refuses to hydrate a revision this code does not know', () => {
        const state = buildState(MID_BUILDING_YELLOW_STARTED).dehydrate()
        const later = { ...state, rideTheRailsRevision: CURRENT_RIDE_THE_RAILS_REVISION + 1 }
        expect(RideTheRailsGameStateValidator.Check(later)).toBe(false)
        expect(() => new HydratedRideTheRailsGameState(later)).toThrow()
        expect(RideTheRailsGameStateValidator.Check({ ...state, rideTheRailsRevision: 0 })).toBe(
            false
        )
    })
})
