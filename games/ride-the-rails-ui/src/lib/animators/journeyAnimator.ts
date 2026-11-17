import type { GameStateChangeListener } from '@tabletop/frontend-components'
import {
    cityById,
    isRideJourney,
    journeyHexIds,
    type CityId,
    type RideJourney
} from '@tabletop/ride-the-rails'
import { boardGeometry, hexCenter, stationOf } from '$lib/utils/boardGeometry.js'
import { passengerSpot, startPassengerSpot } from '$lib/utils/passengerLayout.js'
import { seatMoneyPoint } from './flightPlaces.js'
import { moneyKey, passengerKey, type Flights, type Flyer } from './flights.svelte.js'
import { coinFan, hexStep, journeyCoins, passengerChanges } from './journeyPlan.js'
import {
    JOURNEY,
    PoseTween,
    coinFlyer,
    coinLands,
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

function pulseFlyerKey(index: number, cityId: CityId): string {
    return `pulse:${index}:${cityId}`
}

/** When the travel of a journey over `moves` steps ends and its passenger has faded. */
export function travelEnds(moves: number): number {
    return moves * hexStep(moves) + JOURNEY.fade
}

const COIN_RISE = 24

/**
 * Contract, Animation plan, Journey (Patterns B and D): R-3.3, the start passenger travels the
 * route through the hex centres at its grown size, about 120 ms a hex and at most 2.4 s in all; each city it reaches
 * pulses its station ring once; at the end it fades. Then every dividend coin and the fare rise
 * from the end city and fly to the seats' money together (`flightPlaces`), and money ticks as
 * they land. Without an action (Undo, state-only history) or with reduced motion there is no
 * travel: a passenger taken away shrinks, one put back pops in, and money changes with the state.
 */
export function journeyAnimator(
    flights: Flights,
    /** Whether the rider's own board already shows the start passenger grown in the middle. */
    startsCentred: (playerId: string) => boolean = () => false
): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from) return
        const mode = motionMode(flights, action)
        if (mode === 'still') return
        if (mode === 'cinematic' && isRideJourney(action) && action.metadata) {
            flights.follow(animationContext)
            await ride(flights, { to, animationContext }, action, startsCentred(action.playerId))
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
    { to, animationContext }: Pick<Step, 'to' | 'animationContext'>,
    action: RideJourney,
    centred: boolean
) {
    const metadata = action.metadata
    if (!metadata) return
    const { startCityId, endCityId, cityIds, payments } = metadata
    const hexes = journeyHexIds(action.links)
    const board = boardGeometry(to.mapId)
    // The journey draft is put away while the step plays. The passenger travels grown, as the
    // rider's own draft showed it: from the middle of its hex there, or growing into it from its
    // place in the top right on every other board.
    const spot = centred ? startPassengerSpot(startCityId) : passengerSpot(startCityId, false)
    const grown = startPassengerSpot(startCityId).scale
    // Already standing in the start hex's middle, the passenger sets off for the next hex at once.
    const skipped = centred ? 1 : 0
    const points = [spot, ...hexes.slice(skipped).map(hexCenter)]
    const moves = points.length - 1
    const step = hexStep(moves)

    const passenger = passengerFlyerKey(startCityId)
    const passengerPose = pose(spot.x, spot.y, spot.scale)
    const pulses = cityIds.map((cityId, index) => {
        const station = stationOf(cityId)
        // The passenger reaches a city's hex one step after the hex before it.
        const reaches = (hexes.indexOf(cityById(cityId).hexId) + 1 - skipped) * step
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
        ...coins.map((coin) => coinFlyer(coin.key, coin.amount, false, end))
    ])
    if (!shown) return

    const travel = new PoseTween(flights, animationContext, passenger, passengerPose)
    for (let index = 1; index <= moves; index++) {
        const point = points[index]
        const grows = index === 1 ? { scale: grown } : {}
        travel.to({ x: point.x, y: point.y, ...grows }, step, (index - 1) * step, 'none')
    }
    travel.to({ opacity: 0, scale: grown * 0.6 }, JOURNEY.fade, moves * step, 'power1.in')

    for (const pulse of pulses) {
        new PoseTween(flights, animationContext, pulse.key, pulse.pose)
            .to({ opacity: 1 }, 0.04, pulse.reaches, 'none')
            .to({ scale: 1.9, opacity: 0 }, JOURNEY.pulse, pulse.reaches + 0.04, 'power1.out')
    }

    const rises = travelEnds(moves)
    const lands = coinLands(rises, JOURNEY)
    coins.forEach((coin, index) => {
        flyCoin(
            flights,
            animationContext,
            {
                key: coin.key,
                start: end,
                rise: fan[index],
                marker: seatMoneyPoint(board, flights.table, coin.playerId),
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
