import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import {
    ActionType,
    PhaseName,
    type HexId,
    type HydratedRideTheRailsGameState,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import type { RideTheRailsGameSession } from '$lib/model/session.svelte.js'
import { locomotiveFlyerKey } from './placementAnimator.js'
import { registerFlightAnimators } from './registerFlights.js'

const RED: RailroadId = 'railroad.red'
const CHICAGO: HexId = 'hex.usa.5-43'
const NEXT_TO_CHICAGO: HexId = 'hex.usa.5-41'
const BEYOND_CHICAGO: HexId = 'hex.usa.5-45'

const unregisters: Array<() => void> = []

afterEach(() => {
    for (const unregister of unregisters.splice(0)) unregister()
    disposeSessions()
    vi.restoreAllMocks()
})

function redBesideChicago(): HydratedRideTheRailsGameState {
    return buildState({
        phase: PhaseName.Build,
        shares: { p1: { [RED]: 1 } },
        money: { p1: 10, p2: 10, p3: 10 },
        track: { [NEXT_TO_CHICAGO]: [RED] }
    })
}

async function flying(state: HydratedRideTheRailsGameState) {
    const session = await openSessionOn(state)
    const flights = session.flights
    unregisters.push(registerFlightAnimators(session))
    return { session, flights }
}

async function settled(session: RideTheRailsGameSession) {
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

describe('the flight layer in a session (R-3.2, R-3.2.5)', () => {
    it('gates the seat while a placement flies, and empties once its state is shown', async () => {
        const { session, flights } = await flying(redBesideChicago())
        expect(session.canAct).toBe(true)

        const placing = session.placeLocomotive(RED, CHICAGO)
        await vi.waitFor(() => expect(flights.flyers.length).toBeGreaterThan(0))
        expect(session.updatingVisibleState).toBe(true)
        expect(session.canAct).toBe(false)
        expect(session.boardOffer.lit).toEqual([])

        await placing
        await settled(session)
        expect(session.gameState.track[CHICAGO]).toContain(RED)
        expect(flights.flyers).toEqual([])
        expect(flights.moving).toBe(false)
    })

    it('ends the motion at once on an Undo mid-flight and shows the undone state', async () => {
        const { session, flights } = await flying(redBesideChicago())
        void session.placeLocomotive(RED, CHICAGO)
        await vi.waitFor(() => expect(flights.flyers.length).toBeGreaterThan(0))

        const started = performance.now()
        await session.undo()
        await settled(session)
        expect(performance.now() - started).toBeLessThan(500)
        expect(session.gameState.track[CHICAGO]).toBeUndefined()
        expect(session.gameState.getPlayerState('p1').money).toBe(10)
        expect(flights.flyers).toEqual([])
        expect(flights.hiddenKeys.size).toBe(0)
        expect(flights.interrupted).toBe(false)
    })

    it('replays a building turn one placement after another, then its close, before History exits', async () => {
        const { session, flights } = await flying(redBesideChicago())
        await session.placeLocomotive(RED, CHICAGO)
        await settled(session)
        await session.placeLocomotive(RED, BEYOND_CHICAGO)
        await settled(session)
        await session.endBuilding()
        await settled(session)
        const played = session.gameState.actionCount
        const types = session.actions.map((action) => action.type)
        expect(types).toContain(ActionType.FinishBuilding)

        const seen: Array<{ type?: string; viewing: boolean; flying: string[] }> = []
        const recorder: GameStateChangeListener<HydratedRideTheRailsGameState> = async ({
            action,
            animationContext
        }) => {
            animationContext.afterAnimations(() =>
                seen.push({
                    type: action?.type,
                    viewing: session.isViewingHistory,
                    flying: flights.flyers.map((flyer) => flyer.key)
                })
            )
        }
        session.addGameStateChangeListener(recorder)
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.replayRange(0, session.actions.length - 1, { holdMs: 0 })
        session.removeGameStateChangeListener(recorder)
        await settled(session)

        // Every action plays as its own step, in order, while History is still shown; the
        // return to the live game comes only after the last one has settled.
        const replayed = seen.filter((step) => step.type !== undefined)
        expect(replayed.map((step) => step.type)).toEqual(types)
        expect(replayed.every((step) => step.viewing)).toBe(true)
        expect(seen.slice(0, replayed.length)).toEqual(replayed)
        const second = types.indexOf(ActionType.PlaceLocomotive, 1)
        expect(replayed[second].flying).toEqual(
            expect.arrayContaining([
                locomotiveFlyerKey(`${CHICAGO}:${RED}`),
                locomotiveFlyerKey(`${BEYOND_CHICAGO}:${RED}`)
            ])
        )
        expect(session.isViewingHistory).toBe(false)
        expect(session.gameState.actionCount).toBe(played)
        expect(flights.flyers).toEqual([])
        // With no journey to make after it, the Ride phase passes by itself and the round ends, so
        // the replay runs to the end of round's motion too.
    }, 15_000)

    it('moves nothing when the shown state is swapped silently', async () => {
        const { session, flights } = await flying(redBesideChicago())
        await session.placeLocomotive(RED, CHICAGO)
        await settled(session)
        const show = vi.spyOn(flights, 'show')
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(show.mock.calls.flat(2).filter((flyer) => flyer.kind === 'coin')).toEqual([])
    })
})
