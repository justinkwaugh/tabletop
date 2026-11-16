import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertExists, type GameAction } from '@tabletop/common'
import { AnimationContext, type GameStateChangeListener } from '@tabletop/frontend-components'
import {
    ActionType,
    PhaseName,
    RAILROAD_INTRODUCTIONS,
    isEndRound,
    isRideJourney,
    journeyHexIds,
    type CityId,
    type HexId,
    type HydratedRideTheRailsGameState,
    type Link,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { buildState, engine, hydrated, runAction } from '@tabletop/ride-the-rails/testing'
import { hexCenter, stationOf } from '$lib/utils/boardGeometry.js'
import { passengerSpot } from '$lib/utils/passengerLayout.js'
import { endOfRoundAnimator } from './endOfRoundAnimator.js'
import {
    Flights,
    ROUND_KEY,
    moneyKey,
    passengerKey,
    railroadEntryKey,
    roundTicketKey,
    type FlightTarget
} from './flights.svelte.js'
import { passengerFlyerKey, journeyAnimator, travelEnds } from './journeyAnimator.js'
import { hexStep, journeyCoins, railroadsMadeAvailable, roundStep } from './journeyPlan.js'
import { END_OF_ROUND, JOURNEY, QUICK } from './motion.js'

type State = HydratedRideTheRailsGameState

const RED: RailroadId = 'railroad.red'
const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const CINCINNATI: CityId = 'city.usa.cincinnati'
const KANSAS_CITY_TO_SAINT_LOUIS: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.8-34',
    'hex.usa.8-36',
    'hex.usa.8-38'
]
const SAINT_LOUIS_TO_CINCINNATI: HexId[] = [
    'hex.usa.8-38',
    'hex.usa.8-40',
    'hex.usa.8-42',
    'hex.usa.8-44',
    'hex.usa.8-46'
]
const LINKS: Link[] = [
    { railroadId: RED, hexIds: KANSAS_CITY_TO_SAINT_LOUIS },
    { railroadId: RED, hexIds: SAINT_LOUIS_TO_CINCINNATI }
]

const opened: AnimationContext[] = []

afterEach(() => {
    for (const animationContext of opened.splice(0)) {
        animationContext.actionTimeline.kill()
        animationContext.finalTimeline.kill()
    }
    vi.restoreAllMocks()
})

async function step(
    listener: GameStateChangeListener<State>,
    from: State,
    to: State,
    action?: GameAction
): Promise<AnimationContext> {
    const animationContext = new AnimationContext()
    animationContext.actionTimeline.pause()
    opened.push(animationContext)
    await listener({ kind: action ? 'own-action' : 'undo', from, to, action, animationContext })
    return animationContext
}

/** A stand-in for one of the board's elements, kept by the flight layer under its key. */
class Target implements FlightTarget {
    private readonly attributes = new Map<string, string>()

    getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null
    }

    setAttribute(name: string, value: string) {
        this.attributes.set(name, value)
    }

    removeAttribute(name: string) {
        this.attributes.delete(name)
    }
}

function element(flights: Flights, key: string, attributes: Record<string, string> = {}) {
    const node = new Target()
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
    flights.register(node, key)
    return node
}

function translation(node: FlightTarget): [number, number] {
    const match = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(node.getAttribute('transform') ?? '')
    assertExists(match)
    return [Number(match[1]), Number(match[2])]
}

function reduceMotion() {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
    })
}

// Red runs Kansas City to Saint Louis to Cincinnati; p1 and p3 each hold a Red share. The rider
// is p3, the last in turn order, so its journey ends round 1 (R-2.1).
function riding(currentPlayerId = 'p3'): State {
    return buildState({
        phase: PhaseName.Ride,
        currentPlayerId,
        shares: { p1: { [RED]: 1 }, p3: { [RED]: 1 } },
        money: { p1: 10, p2: 10, p3: 10 },
        track: Object.fromEntries(
            [...KANSAS_CITY_TO_SAINT_LOUIS, ...SAINT_LOUIS_TO_CINCINNATI].map((hexId) => [
                hexId,
                [RED]
            ])
        )
    })
}

/** The state after each action of a run, so each can be presented as its own step. */
function stepsOf(from: State) {
    const playerId = from.activePlayerIds[0]
    const run = runAction(from, { type: ActionType.RideJourney, playerId, links: LINKS })
    const states = [run.after]
    for (const action of run.processed.slice(1).toReversed()) {
        states.unshift(engine.undoProcessedAction({ state: states[0], action }))
    }
    return run.processed.map((action, index) => ({
        action,
        from: index === 0 ? from : hydrated(states[index - 1]),
        to: hydrated(states[index])
    }))
}

describe('the journey plan (R-3.3)', () => {
    it('passes each hex once, the links meeting in their cities', () => {
        expect(journeyHexIds(LINKS)).toEqual([
            ...KANSAS_CITY_TO_SAINT_LOUIS,
            ...SAINT_LOUIS_TO_CINCINNATI.slice(1)
        ])
    })

    it('travels about 120 ms a hex and never more than 2.4 s in all', () => {
        expect(hexStep(8)).toBeCloseTo(JOURNEY.perHex)
        expect(hexStep(40) * 40).toBeCloseTo(JOURNEY.travelCap)
        expect(hexStep(0)).toBe(0)
    })

    it('gives a coin to each seat with dividends and one for the fare (R-3.3.4, R-3.3.5)', () => {
        expect(
            journeyCoins([
                { playerId: 'p1', dividends: 2, fare: 0 },
                { playerId: 'p2', dividends: 0, fare: 0 },
                { playerId: 'p3', dividends: 2, fare: 3 }
            ]).map((coin) => [coin.playerId, coin.amount])
        ).toEqual([
            ['p1', 2],
            ['p3', 2],
            ['p3', 3]
        ])
    })
})

describe('the Journey animator (R-3.3)', () => {
    it('carries the passenger through the hex centres, pulsing each city, then flies every coin together', async () => {
        const flights = new Flights()
        const [ride] = stepsOf(riding())
        assertExists(ride)
        expect(isRideJourney(ride.action)).toBe(true)
        const passenger = passengerFlyerKey(KANSAS_CITY)
        const node = element(flights, passenger)

        const animationContext = await step(
            journeyAnimator(flights),
            ride.from,
            ride.to,
            ride.action
        )

        const hexes = journeyHexIds(LINKS)
        const moves = hexes.length
        const perHex = hexStep(moves)
        expect(perHex).toBeCloseTo(JOURNEY.perHex)
        expect([...flights.hiddenKeys]).toEqual([passengerKey(KANSAS_CITY)])
        const start = passengerSpot(KANSAS_CITY, false)
        const flyer = flights.flyers.find((candidate) => candidate.key === passenger)
        expect(flyer && [flyer.pose.x, flyer.pose.y]).toEqual([start.x, start.y])

        // One pulse for each city on the route, and only there.
        const pulses = flights.flyers.filter((candidate) => candidate.kind === 'pulse')
        expect(pulses.map((pulse) => [pulse.pose.x, pulse.pose.y])).toEqual(
            [KANSAS_CITY, SAINT_LOUIS, CINCINNATI].map((cityId) => {
                const station = stationOf(cityId)
                return [station.x, station.y]
            })
        )

        // The passenger stands on each hex centre in turn, 120 ms apart.
        for (const index of [1, 4, moves]) {
            animationContext.actionTimeline.seek(index * perHex, false)
            const centre = hexCenter(hexes[index - 1])
            const [x, y] = translation(node)
            expect(x).toBeCloseTo(centre.x)
            expect(y).toBeCloseTo(centre.y)
        }

        // Every coin rises from the end city as the passenger fades, and they land together.
        const coins = flights.flyers.filter((candidate) => candidate.kind === 'coin')
        expect(coins.map((coin) => coin.kind === 'coin' && coin.amount)).toEqual([2, 2, 3])
        const lands = travelEnds(moves) + JOURNEY.coinRise + JOURNEY.coinFly
        expect(animationContext.actionTimeline.duration()).toBeCloseTo(lands + JOURNEY.fade)
        animationContext.actionTimeline.seek(lands - 0.01, false)
        expect(flights.shown(moneyKey('p3'), 10)).toBe(10)
        animationContext.actionTimeline.seek(lands + 0.001, false)
        expect(flights.shown(moneyKey('p1'), 10)).toBe(12)
        expect(flights.shown(moneyKey('p3'), 10)).toBe(15)
        expect(flights.shown(moneyKey('p2'), 10)).toBe(10)

        animationContext.actionTimeline.progress(1)
        animationContext.runAfterAnimations()
        expect(flights.flyers).toEqual([])
        expect(flights.hiddenKeys.has(passengerKey(KANSAS_CITY))).toBe(true)
    })

    it('caps a long journey at 2.4 s of travel', async () => {
        expect(travelEnds(60) - JOURNEY.fade).toBeCloseTo(JOURNEY.travelCap)
    })

    it('puts the passenger back with a quick pop on Undo, money changing with the state', async () => {
        const flights = new Flights()
        const [ride] = stepsOf(riding('p1'))
        assertExists(ride)
        const animationContext = await step(journeyAnimator(flights), ride.to, ride.from)
        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
        expect(flights.flyers.map((flyer) => [flyer.key, flyer.pose.scale])).toEqual([
            [passengerFlyerKey(KANSAS_CITY), 0]
        ])
        expect(flights.flyers.some((flyer) => flyer.kind === 'coin')).toBe(false)
        animationContext.actionTimeline.progress(1)
        expect(flights.shown(moneyKey('p1'), 12)).toBe(12)
    })

    it('skips the travel with reduced motion, even with the action', async () => {
        reduceMotion()
        const flights = new Flights()
        const [ride] = stepsOf(riding('p1'))
        assertExists(ride)
        const animationContext = await step(
            journeyAnimator(flights),
            ride.from,
            ride.to,
            ride.action
        )
        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(QUICK.pop)
        expect(flights.flyers.map((flyer) => flyer.kind)).toEqual(['passenger'])
        expect([...flights.hiddenKeys]).toEqual([passengerKey(KANSAS_CITY)])
    })

    it('draws only the travelling pieces: no lit hex, ring or locomotive is touched', async () => {
        const flights = new Flights()
        const [ride] = stepsOf(riding('p1'))
        assertExists(ride)
        await step(journeyAnimator(flights), ride.from, ride.to, ride.action)
        expect(new Set(flights.flyers.map((flyer) => flyer.kind))).toEqual(
            new Set(['passenger', 'pulse', 'coin'])
        )
        expect([...flights.hiddenKeys].every((key) => key.startsWith('passenger:'))).toBe(true)
    })
})

describe('the End of round animator (R-2.5)', () => {
    function lastJourney() {
        const steps = stepsOf(riding())
        const endOfRound = steps.find((candidate) => isEndRound(candidate.action))
        assertExists(endOfRound)
        return { steps, endOfRound }
    }

    it('plans the next round and the railroad it makes available', () => {
        const { endOfRound } = lastJourney()
        const { from, to } = endOfRound
        expect(roundStep(from, to)).toEqual({ from: 1, to: 2 })
        expect(railroadsMadeAvailable(from, to)).toEqual(
            RAILROAD_INTRODUCTIONS[to.mapId]
                .filter((introduction) => introduction.availableFromRound === 2)
                .map((introduction) => introduction.railroadId)
        )
        expect(railroadsMadeAvailable(to, from)).toEqual([])
    })

    it('hops the next ticket and steps the round, then brightens the new railroad, at explicit positions', async () => {
        const flights = new Flights()
        const { endOfRound } = lastJourney()
        const { from, to, action } = endOfRound
        const [orange] = railroadsMadeAvailable(from, to)
        assertExists(orange)
        const ticket = element(flights, roundTicketKey(2))
        const entry = element(flights, railroadEntryKey(orange), { style: 'opacity: 0;' })

        const animationContext = await step(endOfRoundAnimator(flights), from, to, action)
        expect(flights.flyers).toEqual([])
        expect(animationContext.actionTimeline.duration()).toBeCloseTo(
            Math.max(
                END_OF_ROUND.stepsAt + END_OF_ROUND.step,
                END_OF_ROUND.brightensAt + END_OF_ROUND.brighten
            )
        )

        // Just before the top of its hop the ticket is up and the round has not stepped yet.
        const top = END_OF_ROUND.stepsAt + END_OF_ROUND.step / 2
        animationContext.actionTimeline.seek(top - 0.01, false)
        expect(ticket.getAttribute('style')).toMatch(/translateY\(-\d/)
        expect(flights.shown(ROUND_KEY, 1)).toBe(1)
        expect(entry.getAttribute('style')).toBe('opacity: 0;')

        animationContext.actionTimeline.seek(top + 0.01, false)
        expect(flights.shown(ROUND_KEY, 1)).toBe(2)

        animationContext.actionTimeline.progress(1)
        expect(ticket.getAttribute('style')).toBe('transform: translateY(0px) scale(1)')
        expect(entry.getAttribute('style')).toBe('opacity: 1')

        // The new state draws them as it has them: their own styles come back.
        flights.settle()
        expect(ticket.getAttribute('style')).toBeNull()
        expect(entry.getAttribute('style')).toBe('opacity: 0;')
        expect(flights.shown(ROUND_KEY, 2)).toBe(2)
    })

    it('reverses within 200 ms on Undo of the last journey, on the one step that carries both', async () => {
        const flights = new Flights()
        const { steps } = lastJourney()
        const before = steps[0].from
        const after = steps[steps.length - 1].to
        const ticket = element(flights, roundTicketKey(1))
        const journey = journeyAnimator(flights)
        const endOfRound = endOfRoundAnimator(flights)

        const animationContext = new AnimationContext()
        animationContext.actionTimeline.pause()
        opened.push(animationContext)
        const change = { kind: 'undo' as const, from: after, to: before, animationContext }
        await Promise.all([journey(change), endOfRound(change)])

        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
        expect(animationContext.finalTimeline.duration()).toBe(0)
        expect(flights.flyers.map((flyer) => flyer.key)).toEqual([passengerFlyerKey(KANSAS_CITY)])
        animationContext.actionTimeline.progress(1)
        expect(flights.shown(ROUND_KEY, 2)).toBe(1)
        expect(ticket.getAttribute('style')).toBe('transform: translateY(0px) scale(1)')
    })

    it('makes only the quick change with reduced motion', async () => {
        reduceMotion()
        const flights = new Flights()
        const { endOfRound } = lastJourney()
        const animationContext = await step(
            endOfRoundAnimator(flights),
            endOfRound.from,
            endOfRound.to,
            endOfRound.action
        )
        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
    })

    it('moves nothing for a step that leaves the round and the order alone', async () => {
        const flights = new Flights()
        const [ride] = stepsOf(riding('p1'))
        assertExists(ride)
        const animationContext = await step(
            endOfRoundAnimator(flights),
            ride.from,
            ride.to,
            ride.action
        )
        expect(animationContext.actionTimeline.duration()).toBe(0)
        expect(flights.flyers).toEqual([])
    })

    it('moves nothing once an interruption has ended the motion', async () => {
        const flights = new Flights()
        const { endOfRound } = lastJourney()
        flights.interrupt()
        const animationContext = await step(
            endOfRoundAnimator(flights),
            endOfRound.from,
            endOfRound.to,
            endOfRound.action
        )
        expect(animationContext.actionTimeline.duration()).toBe(0)
        expect(flights.flyers).toEqual([])
    })
})
