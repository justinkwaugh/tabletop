import { tick } from 'svelte'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import {
    isRideJourney,
    usaCity,
    type CityId,
    type HydratedRideTheRailsGameState,
    type RideJourney
} from '@tabletop/ride-the-rails'
import { hexCenter, stationOf } from '$lib/utils/boardGeometry.js'
import { turnOrderMarkerPoint } from '$lib/utils/marginLayout.js'
import { passengerSpot } from '$lib/utils/passengerLayout.js'
import { moneyKey, passengerKey, type Flights, type Flyer } from './flights.svelte.js'
import { coinFan, hexStep, journeyCoins, journeyHexes, passengerChanges } from './journeyPlan.js'
import { JOURNEY, PoseTween, QUICK, motionMode, pose, tickAt } from './motion.js'

type State = HydratedRideTheRailsGameState
type Step = Parameters<GameStateChangeListener<State>>[0]

/** The flyer that carries a city's passenger, on its journey or as an Undo puts it back. */
export function passengerFlyerKey(cityId: CityId): string {
    return `flyer:${passengerKey(cityId)}`
}

export function pulseFlyerKey(index: number, cityId: CityId): string {
    return `pulse:${index}:${cityId}`
}

/** When the travel of a journey over `moves` steps ends and its passenger has faded. */
export function travelEnds(moves: number): number {
    return moves * hexStep(moves) + JOURNEY.fade
}

const COIN_RISE = 24

/**
 * Contract, Animation plan, Journey (Patterns B and D): R-3.3, the start passenger travels the
 * route through the hex centres, about 120 ms a hex and at most 2.4 s in all; each city it reaches
 * pulses its station ring once; at the end it fades. Then every dividend coin and the fare rise
 * from the end city and fly to the seats' markers together, and money ticks as they land.
 * Without an action (Undo, state-only history) or with reduced motion there is no travel: a
 * passenger taken away shrinks, one put back pops in, and money changes with the state.
 */
export function journeyAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from) return
        const mode = motionMode(flights, action)
        if (mode === 'still') return
        if (mode === 'cinematic' && isRideJourney(action) && action.metadata) {
            flights.follow(animationContext)
            await ride(flights, { from, to, animationContext }, action)
            return
        }
        const { arriving, leaving } = passengerChanges(from, to)
        if (arriving.length + leaving.length === 0) return
        flights.follow(animationContext)
        await popPassengers(flights, animationContext, arriving, leaving)
    }
}

// R-3.3.2 to R-3.3.6
async function ride(
    flights: Flights,
    { from, to, animationContext }: Pick<Step, 'to' | 'animationContext'> & { from: State },
    action: RideJourney
) {
    const metadata = action.metadata
    if (!metadata) return
    const { startCityId, endCityId, cityIds, payments } = metadata
    const hexes = journeyHexes(action.links)
    // The journey draft, and with it the lifted start, is put away while the step plays.
    const spot = passengerSpot(startCityId, false)
    const points = [spot, ...hexes.map(hexCenter)]
    const moves = points.length - 1
    const step = hexStep(moves)

    const passenger = passengerFlyerKey(startCityId)
    const passengerPose = pose(spot.x, spot.y, spot.scale)
    const pulses = cityIds.map((cityId, index) => {
        const station = stationOf(cityId)
        // The passenger reaches a city's hex one step after the hex before it.
        const reaches = (hexes.indexOf(usaCity(cityId).hexId) + 1) * step
        return {
            key: pulseFlyerKey(index, cityId),
            radius: station.radius,
            pose: pose(station.x, station.y, 1, 0),
            reaches
        }
    })
    const end = stationOf(endCityId)
    const coins = journeyCoins(payments)
    const fan = coinFan(end, coins.length, COIN_RISE)

    flights.hide([passengerKey(startCityId)])
    flights.show([
        ...pulses.map(({ key, radius, pose }): Flyer => ({ key, kind: 'pulse', radius, pose })),
        { key: passenger, kind: 'passenger', pose: passengerPose },
        ...coins.map((coin): Flyer => ({
            key: coin.key,
            kind: 'coin',
            amount: coin.amount,
            gold: false,
            pose: pose(end.x, end.y, 1, 0)
        }))
    ])
    await tick()
    if (flights.interrupted) return

    const travel = new PoseTween(flights, animationContext, passenger, passengerPose)
    for (let index = 1; index <= moves; index++) {
        const point = points[index]
        travel.to({ x: point.x, y: point.y }, step, (index - 1) * step, 'none')
    }
    travel.to({ opacity: 0, scale: spot.scale * 0.6 }, JOURNEY.fade, moves * step, 'power1.in')

    for (const pulse of pulses) {
        new PoseTween(flights, animationContext, pulse.key, pulse.pose)
            .to({ opacity: 1 }, 0.04, pulse.reaches, 'none')
            .to({ scale: 1.9, opacity: 0 }, JOURNEY.pulse, pulse.reaches + 0.04, 'power1.out')
    }

    const rises = travelEnds(moves)
    const lands = rises + JOURNEY.coinRise + JOURNEY.coinFly
    const turnOrder = from.turnManager.turnOrder
    coins.forEach((coin, index) => {
        const marker = turnOrderMarkerPoint(turnOrder, coin.playerId)
        new PoseTween(flights, animationContext, coin.key, pose(end.x, end.y, 1, 0))
            .to({ opacity: 1, ...fan[index] }, JOURNEY.coinRise, rises, 'power1.out')
            .to(
                { x: marker.x, y: marker.y, scale: 0.7 },
                JOURNEY.coinFly,
                rises + JOURNEY.coinRise,
                'power2.in'
            )
            .to({ opacity: 0 }, JOURNEY.fade, lands)
    })
    for (const playerId of new Set(coins.map((coin) => coin.playerId))) {
        const money = to.getPlayerState(playerId).money
        tickAt(animationContext, flights, moneyKey(playerId), money, lands)
    }
    animationContext.afterAnimations(() =>
        flights.remove([
            passenger,
            ...pulses.map((pulse) => pulse.key),
            ...coins.map((coin) => coin.key)
        ])
    )
}

async function popPassengers(
    flights: Flights,
    animationContext: Step['animationContext'],
    arriving: readonly CityId[],
    leaving: readonly CityId[]
) {
    const flyer = (cityId: CityId, shown: boolean): Flyer => {
        const spot = passengerSpot(cityId, false)
        return {
            key: passengerFlyerKey(cityId),
            kind: 'passenger',
            pose: pose(spot.x, spot.y, shown ? spot.scale : 0)
        }
    }
    flights.hide(leaving.map(passengerKey))
    flights.show([
        ...arriving.map((cityId) => flyer(cityId, false)),
        ...leaving.map((cityId) => flyer(cityId, true))
    ])
    await tick()
    if (flights.interrupted) return

    for (const cityId of arriving) {
        const spot = passengerSpot(cityId, false)
        const start = pose(spot.x, spot.y, 0)
        new PoseTween(flights, animationContext, passengerFlyerKey(cityId), start).to(
            { scale: spot.scale },
            QUICK.pop,
            0,
            'back.out(2)'
        )
    }
    for (const cityId of leaving) {
        const spot = passengerSpot(cityId, false)
        const start = pose(spot.x, spot.y, spot.scale)
        new PoseTween(flights, animationContext, passengerFlyerKey(cityId), start).to(
            { scale: 0, opacity: 0 },
            QUICK.pop,
            0,
            'power2.in'
        )
    }
}
