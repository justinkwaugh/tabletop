import { ActionSource } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import type { CityId } from '../data/usaMap.js'
import { ActionType } from '../definition/actions.js'
import { RideTheRailsApiActions } from '../definition/apiActions.js'
import { PhaseName } from '../definition/phases.js'
import { RideTheRailsRuntime } from '../definition/runtime.js'
import type { HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'
import type { Link } from '../rules/routes.js'
import { buildState } from '../testing/fixtures.js'
import { HydratedPassJourney, PassJourneyValidator } from './passJourney.js'
import { HydratedRideJourney, RideJourneyValidator } from './rideJourney.js'

const KANSAS_CITY_TO_SAINT_LOUIS: readonly HexId[] = [
    'hex.usa.8-32',
    'hex.usa.8-34',
    'hex.usa.8-36',
    'hex.usa.8-38'
]
const SAINT_LOUIS_TO_CINCINNATI: readonly HexId[] = [
    'hex.usa.8-38',
    'hex.usa.8-40',
    'hex.usa.8-42',
    'hex.usa.8-44',
    'hex.usa.8-46'
]
const CINCINNATI_TO_PITTSBURGH: readonly HexId[] = [
    'hex.usa.8-46',
    'hex.usa.7-47',
    'hex.usa.7-49',
    'hex.usa.7-51'
]

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'

const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const CINCINNATI: CityId = 'city.usa.cincinnati'
const PITTSBURGH: CityId = 'city.usa.pittsburgh'

function link(railroadId: RailroadId, hexIds: readonly HexId[]): Link {
    return { railroadId, hexIds: [...hexIds] }
}

function trackOf(...paths: [RailroadId, readonly HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of paths) {
        for (const hexId of hexIds) {
            const railroads = Object.hasOwn(track, hexId) ? track[hexId] : []
            if (!railroads.includes(railroadId)) {
                track[hexId] = [...railroads, railroadId]
            }
        }
    }
    return track
}

const NETWORK = trackOf(
    [RED, KANSAS_CITY_TO_SAINT_LOUIS],
    [RED, SAINT_LOUIS_TO_CINCINNATI],
    [BLUE, CINCINNATI_TO_PITTSBURGH]
)

const THROUGH_SAINT_LOUIS: Link[] = [
    link(RED, KANSAS_CITY_TO_SAINT_LOUIS),
    link(RED, SAINT_LOUIS_TO_CINCINNATI),
    link(BLUE, CINCINNATI_TO_PITTSBURGH)
]

const SHARES: Record<string, Shares> = {
    p1: { [RED]: 2 },
    p2: { [RED]: 1, [BLUE]: 1 },
    p3: {}
}

type RidingRecipe = {
    track?: Track
    passengers?: CityId[]
    currentPlayerId?: string
}

function riding({
    track = NETWORK,
    passengers = [KANSAS_CITY, PITTSBURGH],
    currentPlayerId
}: RidingRecipe = {}): HydratedRideTheRailsGameState {
    return buildState({
        phase: PhaseName.Ride,
        currentPlayerId,
        money: { p1: 10, p2: 20, p3: 30 },
        shares: SHARES,
        track,
        passengers
    })
}

function rideJourney(playerId: string, links: Link[]): HydratedRideJourney {
    return new HydratedRideJourney({
        id: 'action-ride',
        gameId: 'ride-the-rails-test',
        source: ActionSource.User,
        type: ActionType.RideJourney,
        playerId,
        links
    })
}

function passJourney(playerId: string): HydratedPassJourney {
    return new HydratedPassJourney({
        id: 'action-pass',
        gameId: 'ride-the-rails-test',
        source: ActionSource.User,
        type: ActionType.PassJourney,
        playerId
    })
}

function moneyOf(state: HydratedRideTheRailsGameState): Record<string, number> {
    return Object.fromEntries(state.players.map(({ playerId, money }) => [playerId, money]))
}

describe('RideJourney (R-3.3, R-X.1)', () => {
    it('is an API action the hydrator rebuilds', () => {
        const action = rideJourney('p1', THROUGH_SAINT_LOUIS)
        expect(RideTheRailsApiActions[ActionType.RideJourney]).toBeDefined()
        expect(RideJourneyValidator.Check(action.dehydrate())).toBe(true)
        expect(RideTheRailsRuntime.hydrator.hydrateAction(action.dehydrate())).toBeInstanceOf(
            HydratedRideJourney
        )
    })

    it('is open to the riding player while a journey exists', () => {
        expect(HydratedRideJourney.canRide(riding(), 'p1')).toBe(true)
        expect(HydratedRideJourney.canRide(riding(), 'p2')).toBe(false)
        expect(HydratedRideJourney.canRide(riding({ track: {} }), 'p1')).toBe(false)
    })

    it('is accepted for a legal journey the player names', () => {
        expect(() => rideJourney('p1', THROUGH_SAINT_LOUIS).apply(riding())).not.toThrow()
    })

    it('is refused to a player whose turn it is not', () => {
        expect(() => rideJourney('p2', THROUGH_SAINT_LOUIS).apply(riding())).toThrow(
            'It is not your journey'
        )
    })

    it('is refused outside Ride the Rails', () => {
        const state = buildState({
            phase: PhaseName.Build,
            currentPlayerId: 'p1',
            track: NETWORK,
            passengers: [KANSAS_CITY]
        })
        expect(() => rideJourney('p1', THROUGH_SAINT_LOUIS).apply(state)).toThrow(
            'It is not your journey'
        )
    })

    it.each<[string, Link[]]>([
        ['no-links', []],
        ['not-a-link', [link(BLUE, KANSAS_CITY_TO_SAINT_LOUIS)]],
        [
            'links-do-not-meet',
            [link(RED, KANSAS_CITY_TO_SAINT_LOUIS), link(BLUE, CINCINNATI_TO_PITTSBURGH)]
        ],
        ['no-passenger', [link(RED, SAINT_LOUIS_TO_CINCINNATI)]],
        [
            'hex-visited-twice',
            [
                link(RED, KANSAS_CITY_TO_SAINT_LOUIS),
                link(RED, [...KANSAS_CITY_TO_SAINT_LOUIS].reverse())
            ]
        ]
    ])('is refused when the journey test says %s', (reason, links) => {
        expect(() => rideJourney('p1', links).apply(riding())).toThrow(reason)
    })

    it('pays every player dividends per link and share, and the rider a fare per city visited (R-3.3.2, R-3.3.4, R-3.3.5)', () => {
        const state = riding()
        rideJourney('p1', THROUGH_SAINT_LOUIS).apply(state)
        expect(moneyOf(state)).toEqual({ p1: 10 + 2 * 2 + 4, p2: 20 + 2 * 1 + 1 * 1, p3: 30 })
    })

    it('removes the start passenger and leaves the end passenger (R-3.3.6)', () => {
        const state = riding()
        rideJourney('p1', THROUGH_SAINT_LOUIS).apply(state)
        expect(state.passengers).toEqual([PITTSBURGH])
    })

    it('records the cities, links per railroad and every payment in metadata', () => {
        const action = rideJourney('p1', THROUGH_SAINT_LOUIS)
        action.apply(riding())
        expect(action.metadata).toEqual({
            startCityId: KANSAS_CITY,
            endCityId: PITTSBURGH,
            cityIds: [KANSAS_CITY, SAINT_LOUIS, CINCINNATI, PITTSBURGH],
            linksPerRailroad: { [RED]: 2, [BLUE]: 1 },
            payments: [
                { playerId: 'p1', dividends: 4, fare: 4 },
                { playerId: 'p2', dividends: 3, fare: 0 },
                { playerId: 'p3', dividends: 0, fare: 0 }
            ]
        })
        expect(RideJourneyValidator.Check(action.dehydrate())).toBe(true)
    })

    it('pays a one-link journey a fare of two and changes nothing else', () => {
        const state = riding({ currentPlayerId: 'p3' })
        const before = state.dehydrate()
        rideJourney('p3', [link(RED, KANSAS_CITY_TO_SAINT_LOUIS)]).apply(state)
        expect(moneyOf(state)).toEqual({ p1: 12, p2: 21, p3: 32 })
        expect(state.track).toEqual(before.track)
        expect(state.players.map(({ shares }) => shares)).toEqual(
            before.players.map(({ shares }) => shares)
        )
    })
})

describe('PassJourney (R-3.3.1)', () => {
    it('is an API action the hydrator rebuilds', () => {
        const action = passJourney('p1')
        expect(RideTheRailsApiActions[ActionType.PassJourney]).toBeDefined()
        expect(PassJourneyValidator.Check(action.dehydrate())).toBe(true)
        expect(RideTheRailsRuntime.hydrator.hydrateAction(action.dehydrate())).toBeInstanceOf(
            HydratedPassJourney
        )
    })

    it('is open only when no passenger can be carried on a legal journey', () => {
        expect(HydratedPassJourney.canPass(riding(), 'p1')).toBe(false)
        expect(HydratedPassJourney.canPass(riding({ track: {} }), 'p1')).toBe(true)
        expect(
            HydratedPassJourney.canPass(riding({ passengers: ['city.usa.chicago'] }), 'p1')
        ).toBe(true)
        expect(HydratedPassJourney.canPass(riding({ track: {} }), 'p2')).toBe(false)
    })

    it('is refused while a journey exists', () => {
        expect(() => passJourney('p1').apply(riding())).toThrow(
            'A journey exists, so you must ride'
        )
    })

    it('is refused to a player whose turn it is not', () => {
        expect(() => passJourney('p2').apply(riding({ track: {} }))).toThrow(
            'It is not your journey'
        )
    })

    it('pays nothing and leaves the passengers on the board', () => {
        const state = riding({ track: {} })
        const before = state.dehydrate()
        passJourney('p1').apply(state)
        expect(state.dehydrate()).toEqual(before)
    })
})
