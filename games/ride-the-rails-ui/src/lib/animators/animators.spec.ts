import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { AnimationContext, type GameStateChangeListener } from '@tabletop/frontend-components'
import {
    ActionType,
    PhaseName,
    adjacentHexIds,
    isPlaceLocomotive,
    type PlaceLocomotive,
    supplyOf,
    transcontinentalLine,
    usaCity,
    type HexId,
    type HydratedRideTheRailsGameState,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { buildState, hydrated, runAction } from '@tabletop/ride-the-rails/testing'
import { ABOVE_THE_BOARD, TRAVELLING_LOCOMOTIVE_WIDTH } from './flightPlaces.js'
import { Flights, moneyKey, sharesKey, supplyKey } from './flights.svelte.js'
import { OUTLINE_TOTAL, outlineStep } from './flightPlan.js'
import { FLIGHT, QUICK } from './motion.js'
import { locomotiveFlyerKey, placementAnimator } from './placementAnimator.js'
import { SHARE_FLYER_KEY, shareAnimator } from './shareAnimator.js'
import {
    OUTLINES_BEGIN,
    TRANSCONTINENTAL_COIN_KEY,
    TRANSCONTINENTAL_LINE_KEY,
    transcontinentalAnimator
} from './transcontinentalAnimator.js'

type State = HydratedRideTheRailsGameState

const RED: RailroadId = 'railroad.red'
const PURPLE: RailroadId = 'railroad.purple'
const CHICAGO: HexId = 'hex.usa.5-43'
const NEXT_TO_CHICAGO: HexId = 'hex.usa.5-41'
const NEW_YORK = usaCity('city.usa.new-york').hexId
const SEATTLE = usaCity('city.usa.seattle').hexId

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

/** Every timeline call and tween up to the end, as the step would play it. */
function playThrough(animationContext: AnimationContext) {
    animationContext.actionTimeline.progress(1)
}

function building(track: Track, shares: RailroadId[] = [RED]): State {
    return buildState({
        phase: PhaseName.Build,
        shares: { p1: Object.fromEntries(shares.map((railroadId) => [railroadId, 1])) },
        money: { p1: 10, p2: 10, p3: 10 },
        track
    })
}

function placed(state: State, railroadId: RailroadId, hexId: HexId) {
    const run = runAction(state, {
        type: ActionType.PlaceLocomotive,
        playerId: 'p1',
        railroadId,
        hexId
    })
    const action = run.processed[0]
    expect(isPlaceLocomotive(action)).toBe(true)
    return { action, to: hydrated(run.after) }
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

describe('the Placement animator (R-3.2, R-3.2.5, R-4.3)', () => {
    it('flies the locomotive from its supply pile and the Chicago coin to the seat, ticking money as it lands', async () => {
        const flights = new Flights()
        const from = building({ [NEXT_TO_CHICAGO]: [RED] })
        const { action, to } = placed(from, RED, CHICAGO)

        const animationContext = await step(placementAnimator(flights), from, to, action)

        const key = locomotiveFlyerKey(`${CHICAGO}:${RED}`)
        const locomotive = flights.flyers.find((flyer) => flyer.key === key)
        assertExists(locomotive)
        // With no table drawn, nothing shows the pile: it lifts from above the board.
        expect([locomotive.pose.x, locomotive.pose.y]).toEqual([
            ABOVE_THE_BOARD.x,
            ABOVE_THE_BOARD.y
        ])
        expect(
            locomotive.pose.scale * (locomotive.kind === 'locomotive' ? locomotive.width : 0)
        ).toBeCloseTo(TRAVELLING_LOCOMOTIVE_WIDTH)
        expect(
            flights.flyers
                .filter((flyer) => flyer.kind === 'coin')
                .map((coin) => coin.kind === 'coin' && coin.amount)
        ).toEqual([2])
        expect(animationContext.actionTimeline.duration()).toBeGreaterThan(FLIGHT.lands)

        expect(flights.shown(moneyKey('p1'), 10)).toBe(10)
        playThrough(animationContext)
        expect(flights.shown(moneyKey('p1'), 10)).toBe(12)
        expect(flights.shown(supplyKey(RED), 0)).toBe(supplyOf(to, RED))
        animationContext.runAfterAnimations()
        expect(flights.flyers.map((flyer) => flyer.key)).toEqual([key])
    })

    it('lands a start with a bounce after the flight (R-4.2)', async () => {
        const flights = new Flights()
        const from = building({})
        const { action, to } = placed(from, RED, NEW_YORK)
        const animationContext = await step(placementAnimator(flights), from, to, action)
        expect(animationContext.actionTimeline.duration()).toBeCloseTo(
            FLIGHT.lands + FLIGHT.bounce + FLIGHT.settle
        )
    })

    it('pops locomotives in and out within 200 ms without an action, hiding the one taken away', async () => {
        const flights = new Flights()
        const from = building({ [NEXT_TO_CHICAGO]: [RED] })
        const { to } = placed(from, RED, CHICAGO)
        const listener = placementAnimator(flights)

        const forward = await step(listener, from, to)
        expect(forward.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
        expect(flights.flyers.map((flyer) => flyer.pose.scale)).toEqual([0])
        expect(flights.flyers.some((flyer) => flyer.kind === 'coin')).toBe(false)

        flights.settle()
        const back = await step(listener, to, from)
        expect(back.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
        expect([...flights.hiddenKeys]).toEqual([`${CHICAGO}:${RED}`])
        expect(flights.flyers.map((flyer) => flyer.key)).toEqual([
            locomotiveFlyerKey(`${CHICAGO}:${RED}`)
        ])
        expect(QUICK.pop).toBeLessThanOrEqual(0.2)
    })

    it('makes only the quick change with reduced motion, even with an action', async () => {
        reduceMotion()
        const flights = new Flights()
        const from = building({ [NEXT_TO_CHICAGO]: [RED] })
        const { action, to } = placed(from, RED, CHICAGO)
        const animationContext = await step(placementAnimator(flights), from, to, action)
        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
        expect(flights.flyers.some((flyer) => flyer.kind === 'coin')).toBe(false)
    })

    it('moves nothing once an interruption has ended the motion', async () => {
        const flights = new Flights()
        const from = building({ [NEXT_TO_CHICAGO]: [RED] })
        const { action, to } = placed(from, RED, CHICAGO)
        flights.interrupt()
        const animationContext = await step(placementAnimator(flights), from, to, action)
        expect(animationContext.actionTimeline.duration()).toBe(0)
        expect(flights.flyers).toEqual([])
    })
})

describe('the Share animator (R-3.1)', () => {
    it('flies a locomotive from the supply pile to the seat, ticking supply as it lifts and shares as it lands', async () => {
        const flights = new Flights()
        const from = buildState({ phase: PhaseName.TakeShare })
        const run = runAction(from, { type: ActionType.TakeShare, playerId: 'p3', railroadId: RED })
        const to = hydrated(run.after)

        const animationContext = await step(shareAnimator(flights), from, to, run.processed[0])
        expect(flights.flyers.map((flyer) => [flyer.key, flyer.pose.x, flyer.pose.y])).toEqual([
            [SHARE_FLYER_KEY, ABOVE_THE_BOARD.x, ABOVE_THE_BOARD.y]
        ])
        playThrough(animationContext)
        expect(flights.shown(supplyKey(RED), 27)).toBe(26)
        expect(flights.shown(sharesKey('p3', RED), 0)).toBe(1)
        animationContext.runAfterAnimations()
        expect(flights.flyers).toEqual([])

        const undo = await step(shareAnimator(flights), to, from)
        expect(undo.actionTimeline.duration()).toBe(0)
    })
})

describe('the Transcontinental animator (R-4.3.3)', () => {
    // A Purple line from Seattle meets Red, which reaches New York once its last hex is placed.
    function nearlyAcross() {
        const across = (() => {
            const previous = new Map<HexId, HexId | undefined>([[SEATTLE, undefined]])
            const queue = [SEATTLE]
            for (let index = 0; index < queue.length; index++) {
                for (const next of adjacentHexIds(queue[index])) {
                    if (!previous.has(next)) {
                        previous.set(next, queue[index])
                        queue.push(next)
                    }
                }
            }
            const path: HexId[] = []
            for (let hexId: HexId | undefined = NEW_YORK; hexId; hexId = previous.get(hexId)) {
                path.unshift(hexId)
            }
            return path
        })()
        const split = Math.floor(across.length / 2)
        const track: Track = {}
        for (const hexId of across.slice(0, split + 1)) track[hexId] = [PURPLE]
        for (const hexId of across.slice(split, -1)) track[hexId] = [...(track[hexId] ?? []), RED]
        const last = across[across.length - 1]
        const from = building(track, [RED, PURPLE])
        const to = building({ ...track, [last]: [RED] }, [RED, PURPLE])
        to.transcontinental = { playerId: 'p1', amount: 8 }
        to.getPlayerState('p1').money = 18
        const action: PlaceLocomotive = {
            id: 'claim',
            source: ActionSource.User,
            gameId: from.gameId,
            type: ActionType.PlaceLocomotive,
            playerId: 'p1',
            railroadId: RED,
            hexId: last
        }
        return { from, to, action }
    }

    /** The attributes the animator writes on a flyer's wrapper, as if the flight layer drew it. */
    function drawnAttributes(flights: Flights, key: string): Map<string, string> {
        const attributes = new Map<string, string>()
        flights.register(
            {
                getAttribute: (name) => attributes.get(name) ?? null,
                setAttribute: (name, value) => void attributes.set(name, value),
                removeAttribute: (name) => void attributes.delete(name)
            },
            key
        )
        return attributes
    }

    const hidden = () => false
    const shown = () => true

    it('outlines the line within 900 ms after the placement lands, then flies a gold coin', async () => {
        const flights = new Flights()
        const { from, to, action } = nearlyAcross()
        const line = transcontinentalLine(to.track)?.hexIds
        assertExists(line)

        const animationContext = await step(
            transcontinentalAnimator(flights, hidden),
            from,
            to,
            action
        )
        const outlines = flights.flyers.filter((flyer) => flyer.kind === 'outline')
        expect(outlines.length).toBe(line.length)
        expect(flights.flyers.map((flyer) => flyer.key)).toContain(TRANSCONTINENTAL_LINE_KEY)
        const coin = flights.flyers.find((flyer) => flyer.key === TRANSCONTINENTAL_COIN_KEY)
        expect(coin?.kind === 'coin' && [coin.amount, coin.gold]).toEqual([8, true])

        const drawn = OUTLINES_BEGIN + OUTLINE_TOTAL
        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(
            drawn + 0.2 + FLIGHT.coinRise + FLIGHT.coinFly + FLIGHT.fade + 1e-9
        )
        playThrough(animationContext)
        expect(flights.shown(moneyKey('p1'), 10)).toBe(18)
    })

    it('fades the settled line out as the coin lands while the viewer keeps it hidden', async () => {
        const flights = new Flights()
        const { from, to, action } = nearlyAcross()
        const line = drawnAttributes(flights, TRANSCONTINENTAL_LINE_KEY)
        const animationContext = await step(
            transcontinentalAnimator(flights, hidden),
            from,
            to,
            action
        )
        const duration = animationContext.actionTimeline.duration()

        const hexes = transcontinentalLine(to.track)?.hexIds.length ?? 0
        const drawn = OUTLINES_BEGIN + hexes * outlineStep(hexes)
        const lands = drawn + 0.2 + FLIGHT.coinRise + FLIGHT.coinFly
        animationContext.actionTimeline.seek(lands - 0.01, false)
        expect(Number(line.get('opacity'))).toBe(1)
        playThrough(animationContext)
        expect(Number(line.get('opacity'))).toBe(0)
        // The fade ends with the coin's, so the claim takes no longer.
        expect(duration).toBeCloseTo(lands + FLIGHT.fade, 9)
        animationContext.runAfterAnimations()
        expect(flights.flyers).toEqual([])
    })

    it('keeps the settled line drawn until the state draws it while the viewer shows it', async () => {
        const flights = new Flights()
        const { from, to, action } = nearlyAcross()
        const line = drawnAttributes(flights, TRANSCONTINENTAL_LINE_KEY)
        const animationContext = await step(
            transcontinentalAnimator(flights, shown),
            from,
            to,
            action
        )
        playThrough(animationContext)
        expect(Number(line.get('opacity'))).toBe(1)
        animationContext.runAfterAnimations()
        expect(flights.flyers.map((flyer) => flyer.key)).toEqual([TRANSCONTINENTAL_LINE_KEY])
    })

    it('shows the line with the state, without motion, when there is no action', async () => {
        const flights = new Flights()
        const { from, to } = nearlyAcross()
        const animationContext = await step(transcontinentalAnimator(flights, hidden), from, to)
        expect(animationContext.actionTimeline.duration()).toBe(0)
        expect(flights.flyers).toEqual([])
    })
})

describe('the flight layer state', () => {
    it('ends a playing step at once when interrupted, and empties', async () => {
        const flights = new Flights()
        flights.show([
            {
                key: 'a',
                kind: 'coin',
                amount: 2,
                gold: false,
                pose: { x: 0, y: 0, scale: 1, opacity: 1 }
            }
        ])
        flights.tick(moneyKey('p1'), 12)
        flights.hide(['x'])
        const animationContext = new AnimationContext()
        opened.push(animationContext)
        animationContext.actionTimeline.to({ value: 0 }, { value: 1, duration: 5 }, 0)
        flights.follow(animationContext)

        const started = performance.now()
        const playing = animationContext.play()
        await new Promise((resolve) => setTimeout(resolve, 20))
        flights.interrupt()
        await playing
        expect(performance.now() - started).toBeLessThan(1000)
        expect(flights.flyers).toEqual([])
        expect(flights.hiddenKeys.size).toBe(0)
        expect(flights.shown(moneyKey('p1'), 10)).toBe(10)
        expect(flights.interrupted).toBe(true)

        flights.settle()
        expect(flights.interrupted).toBe(false)
    })

    it('drops a step still being built when interrupted', () => {
        const flights = new Flights()
        const animationContext = new AnimationContext()
        opened.push(animationContext)
        animationContext.actionTimeline.to({ value: 0 }, { value: 1, duration: 5 }, 0)
        flights.follow(animationContext)
        flights.interrupt()
        expect(animationContext.actionTimeline.duration()).toBe(0)
    })
})
