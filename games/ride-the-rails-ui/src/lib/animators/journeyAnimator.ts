import type { GameStateChangeListener } from '@tabletop/frontend-components'
import {
    isRideJourney,
    journeyHexIds,
    usaCity,
    type CityId,
    type RideJourney
} from '@tabletop/ride-the-rails'
import { hexCenter, stationOf } from '$lib/utils/boardGeometry.js'
import { passengerSpot } from '$lib/utils/passengerLayout.js'
import { seatMoneyPoint } from './flightPlaces.js'
import { moneyKey, passengerKey, type Flights, type Flyer } from './flights.svelte.js'
import { coinFan, hexStep, journeyCoins, passengerChanges } from './journeyPlan.js'
import {
    JOURNEY,
    PoseTween,
    flyCoin,
    motionMode,
    popFlyers,
    pose,
    showFlyers,
    tickAt,
    type State,
    type Step
} from './motion.js'

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
 * passenger taken away shrinks, one put back pops in, and money changes with the state. On a phone
 * the coins land on the seats' money (`flightPlaces`).
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
        await popFlyers(flights, animationContext, {
            arriving: arriving.map(passengerFlyer),
            leaving: leaving.map(passengerFlyer),
            hidden: leaving.map(passengerKey)
        })
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
    const hexes = journeyHexIds(action.links)
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
    const shown = await showFlyers(flights, [
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
    if (!shown) return

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
    const turnOrder = from.turnManager.turnOrder
    const lands = rises + JOURNEY.coinRise + JOURNEY.coinFly
    coins.forEach((coin, index) => {
        flyCoin(
            flights,
            animationContext,
            {
                key: coin.key,
                start: end,
                rise: fan[index],
                marker: seatMoneyPoint(turnOrder, coin.playerId),
                rises
            },
            JOURNEY
        )
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

function passengerFlyer(cityId: CityId): Flyer {
    const spot = passengerSpot(cityId, false)
    return {
        key: passengerFlyerKey(cityId),
        kind: 'passenger',
        pose: pose(spot.x, spot.y, spot.scale)
    }
}
