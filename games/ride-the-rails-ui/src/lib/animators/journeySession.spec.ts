import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { assert } from '@tabletop/common'
import {
    AnimationContext,
    GameContext,
    type GameStateChangeListener
} from '@tabletop/frontend-components'
import {
    ActionType,
    PhaseName,
    cityById,
    isRideJourney,
    type CityId,
    type HexId,
    type HydratedRideTheRailsGameState,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import type { RideTheRailsGameSession } from '$lib/model/session.svelte.js'
import { ROUND_KEY } from './flights.svelte.js'
import { passengerFlyerKey } from './journeyAnimator.js'
import { registerFlightAnimators } from './registerFlights.js'

type State = HydratedRideTheRailsGameState

const RED: RailroadId = 'railroad.red'
const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const CINCINNATI: CityId = 'city.usa.cincinnati'
const ROUTE: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.8-34',
    'hex.usa.8-36',
    'hex.usa.8-38',
    'hex.usa.8-40',
    'hex.usa.8-42',
    'hex.usa.8-44',
    'hex.usa.8-46'
]

const unregisters: Array<() => void> = []

afterEach(() => {
    for (const unregister of unregisters.splice(0)) unregister()
    disposeSessions()
    vi.restoreAllMocks()
})

// Red runs Kansas City to Saint Louis to Cincinnati; p1 and p3 each hold a Red share. The rider
// is p3, the last in turn order, so its journey ends round 1 (R-2.1, R-2.5).
function riding(): State {
    return buildState({
        phase: PhaseName.Ride,
        currentPlayerId: 'p3',
        shares: { p1: { [RED]: 1 }, p3: { [RED]: 1 } },
        money: { p1: 10, p2: 10, p3: 10 },
        track: Object.fromEntries(ROUTE.map((hexId) => [hexId, [RED]]))
    })
}

async function staged() {
    const session = await openSessionOn(riding())
    const flights = session.flights
    unregisters.push(registerFlightAnimators(session))
    for (const cityId of [KANSAS_CITY, SAINT_LOUIS, CINCINNATI]) {
        await session.pressHex(cityById(cityId).hexId)
    }
    expect(session.canRideJourney).toBe(true)
    return { session, flights }
}

async function settled(session: RideTheRailsGameSession) {
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

function round(session: RideTheRailsGameSession) {
    return session.gameState.roundManager.currentRound?.number
}

/** How long each step's timeline runs, recorded as the step plays. */
function timelineLengths() {
    const lengths: number[] = []
    const play = AnimationContext.prototype.play
    vi.spyOn(AnimationContext.prototype, 'play').mockImplementation(function (
        this: AnimationContext
    ) {
        lengths.push(this.actionTimeline.duration())
        return play.call(this)
    })
    return lengths
}

describe('a journey and the end of round in a session (R-3.3, R-2.5)', () => {
    it('gates the seat while the passenger travels, with nothing lit', async () => {
        const { session, flights } = await staged()
        const riding = session.rideJourney()
        await vi.waitFor(() =>
            expect(flights.flyers.map((flyer) => flyer.key)).toContain(
                passengerFlyerKey(KANSAS_CITY)
            )
        )
        expect(session.updatingVisibleState).toBe(true)
        expect(session.canAct).toBe(false)
        expect(session.boardOffer.lit).toEqual([])

        await riding
        await settled(session)
        expect(round(session)).toBe(2)
        expect(session.gameState.turnManager.turnOrder).toEqual(['p2', 'p1', 'p3'])
        expect(session.gameState.passengers).not.toContain(KANSAS_CITY)
        expect(flights.flyers).toEqual([])
        expect(flights.hiddenKeys.size).toBe(0)
    })

    it('plays the end of round only once the journey’s motion has played', async () => {
        const { session, flights } = await staged()
        const order: string[] = []
        const recorder: GameStateChangeListener<State> = async ({ action, animationContext }) => {
            order.push(`start ${action?.type}`)
            animationContext.afterAnimations(() => order.push(`end ${action?.type}`))
        }
        session.addGameStateChangeListener(recorder)
        const motion: string[] = []
        const show = flights.show.bind(flights)
        const tick = flights.tick.bind(flights)
        vi.spyOn(flights, 'show').mockImplementation((flyers) => {
            motion.push(...flyers.map((flyer) => `show ${flyer.key}`))
            show(flyers)
        })
        vi.spyOn(flights, 'tick').mockImplementation((key, value) => {
            motion.push(`tick ${key}`)
            tick(key, value)
        })
        await session.rideJourney()
        await settled(session)
        session.removeGameStateChangeListener(recorder)

        expect(order).toEqual([
            `start ${ActionType.RideJourney}`,
            `end ${ActionType.RideJourney}`,
            `start ${ActionType.EndRound}`,
            `end ${ActionType.EndRound}`
        ])
        expect(motion.indexOf(`tick ${ROUND_KEY}`)).toBeGreaterThan(
            motion.indexOf(`show ${passengerFlyerKey(KANSAS_CITY)}`)
        )
        expect(motion.indexOf(`show ${passengerFlyerKey(KANSAS_CITY)}`)).toBeGreaterThanOrEqual(0)
    })

    it('ends the motion at once on an Undo mid-flight and puts round 1 back', async () => {
        const { session, flights } = await staged()
        const before = session.gameState.turnManager.turnOrder
        void session.rideJourney()
        await vi.waitFor(() => expect(flights.flyers.length).toBeGreaterThan(0))

        const lengths = timelineLengths()
        await session.undo()
        await settled(session)
        expect(round(session)).toBe(1)
        expect(session.gameState.turnManager.turnOrder).toEqual(before)
        expect(session.gameState.passengers).toContain(KANSAS_CITY)
        expect(flights.flyers).toEqual([])
        expect(flights.hiddenKeys.size).toBe(0)
        expect(lengths.every((length) => length <= 0.2)).toBe(true)
    })

    it('lands every change within 200 ms when Undo takes the round back', async () => {
        const { session, flights } = await staged()
        await session.rideJourney()
        await settled(session)

        const lengths = timelineLengths()
        await session.undo()
        await settled(session)
        expect(round(session)).toBe(1)
        expect(session.gameState.passengers).toContain(KANSAS_CITY)
        expect(lengths.length).toBeGreaterThan(0)
        expect(lengths.every((length) => length <= 0.2)).toBe(true)
        expect(flights.flyers).toEqual([])
    })

    it('lands every change within 200 ms on state-only history steps', async () => {
        const { session } = await staged()
        await session.rideJourney()
        await settled(session)
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))

        const lengths = timelineLengths()
        await session.history.goToActionIndex(-1)
        await settled(session)
        expect(round(session)).toBe(1)
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToNextAction()
        await settled(session)
        expect(lengths.every((length) => length <= 0.2)).toBe(true)
    })

    it('replays the journey and its end of round inside History, then exits with no motion', async () => {
        const { session, flights } = await staged()
        await session.rideJourney()
        await settled(session)
        const types = session.actions.map((action) => action.type)
        expect(types).toEqual([ActionType.RideJourney, ActionType.EndRound])

        const seen: Array<{ type?: string; viewing: boolean }> = []
        const recorder: GameStateChangeListener<State> = async ({ action, animationContext }) => {
            animationContext.afterAnimations(() =>
                seen.push({ type: action?.type, viewing: session.isViewingHistory })
            )
        }
        session.addGameStateChangeListener(recorder)
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.replayRange(0, session.actions.length - 1, { holdMs: 0 })
        const show = vi.spyOn(flights, 'show')
        await settled(session)
        session.removeGameStateChangeListener(recorder)

        const replayed = seen.filter((step) => step.type !== undefined)
        expect(replayed.map((step) => step.type)).toEqual(types)
        expect(replayed.every((step) => step.viewing)).toBe(true)
        expect(session.isViewingHistory).toBe(false)
        expect(show).not.toHaveBeenCalled()
        expect(flights.flyers).toEqual([])
    }, 15_000)

    // U-7: History View draws the displayed action's journey, and the passenger rides it.
    it('draws the replayed journey’s line while its passenger travels in History', async () => {
        const { session, flights } = await staged()
        await session.rideJourney()
        await settled(session)
        const ride = session.actions[0]
        assert(isRideJourney(ride), 'the first action is a ride')
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToActionIndex(-1)
        await settled(session)
        expect(session.lastJourney).toEqual([])

        const drawn: unknown[] = []
        const recorder: GameStateChangeListener<State> = async ({ action, animationContext }) => {
            if (action?.type !== ActionType.RideJourney) return
            animationContext.actionTimeline.call(
                () => {
                    flushSync()
                    drawn.push(session.lastJourney)
                },
                [],
                0.1
            )
        }
        session.addGameStateChangeListener(recorder)
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.replayRange(0, 0, { holdMs: 0 })
        await settled(session)
        session.removeGameStateChangeListener(recorder)

        expect(drawn).toEqual([ride.links])
        expect(flights.flyers).toEqual([])
    }, 15_000)

    it('steps back through History state-only with no travel and no coins', async () => {
        const { session, flights } = await staged()
        await session.rideJourney()
        await settled(session)
        const show = vi.spyOn(flights, 'show')
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToActionIndex(-1)
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(round(session)).toBe(1)
        const kinds = show.mock.calls.flat(2).map((flyer) => flyer.kind)
        expect(kinds.filter((kind) => kind === 'coin' || kind === 'pulse')).toEqual([])
    })

    it('moves nothing when the shown state is restored silently', async () => {
        const { session, flights } = await staged()
        await session.rideJourney()
        await settled(session)
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToActionIndex(-1)
        await settled(session)
        const position = session.history.capturePosition()
        session.history.goToEnd()
        await settled(session)
        expect(round(session)).toBe(2)

        const show = vi.spyOn(flights, 'show')
        const write = vi.spyOn(flights, 'write')
        // The session hands History its own context when it returns from an exploration.
        const context: unknown = Reflect.get(session, 'gameContext')
        if (!(context instanceof GameContext)) throw new Error('the session has no game context')
        session.history.restorePosition(context, position)
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(round(session)).toBe(1)
        expect(show).not.toHaveBeenCalled()
        expect(write).not.toHaveBeenCalled()
        expect(flights.flyers).toEqual([])
    })
})
