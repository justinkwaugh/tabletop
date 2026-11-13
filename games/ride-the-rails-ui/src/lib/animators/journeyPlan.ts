import type { Point } from '@tabletop/common'
import {
    RAILROAD_INTRODUCTIONS,
    type CityId,
    type HexId,
    type HydratedRideTheRailsGameState,
    type JourneyPayment,
    type Link,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { turnOrderMarkerPoint } from '$lib/utils/marginLayout.js'
import { JOURNEY } from './motion.js'

type State = HydratedRideTheRailsGameState

// R-3.3.2, R-3.3.3: the hexes a journey passes, start city to end city; its links meet in cities.
export function journeyHexes(links: readonly Link[]): HexId[] {
    return links.flatMap((link, index) => (index === 0 ? link.hexIds : link.hexIds.slice(1)))
}

/** Contract, Animation plan: about 120 ms a hex, the whole travel capped at 2.4 s. */
export function hexStep(moves: number): number {
    return moves === 0 ? 0 : Math.min(JOURNEY.perHex, JOURNEY.travelCap / moves)
}

export type JourneyCoin = { key: string; playerId: string; amount: number }

// R-3.3.4, R-3.3.5: a coin for each seat's dividends and one for the rider's fare.
export function journeyCoins(payments: readonly JourneyPayment[]): JourneyCoin[] {
    return payments.flatMap(({ playerId, dividends, fare }) => [
        ...(dividends > 0
            ? [{ key: `coin:dividends:${playerId}`, playerId, amount: dividends }]
            : []),
        ...(fare > 0 ? [{ key: `coin:fare:${playerId}`, playerId, amount: fare }] : [])
    ])
}

/** Where each of `count` coins rises to above the point it leaves, fanned out side by side. */
export function coinFan(origin: Point, count: number, rise: number): Point[] {
    return Array.from({ length: count }, (_, index) => ({
        x: origin.x + (index - (count - 1) / 2) * JOURNEY.coinSpread,
        y: origin.y - rise
    }))
}

// R-3.3.6: the passengers the transition takes from the board, and the ones it puts back (Undo).
export function passengerChanges(
    from: State,
    to: State
): { arriving: CityId[]; leaving: CityId[] } {
    const before = new Set(from.passengers)
    const after = new Set(to.passengers)
    return {
        arriving: to.passengers.filter((cityId) => !before.has(cityId)),
        leaving: from.passengers.filter((cityId) => !after.has(cityId))
    }
}

export type MarkerSlide = { playerId: string; from: Point; to: Point }

// R-2.5.1: the seats whose turn-order marker moves, from where it is shown to its new place.
export function markerSlides(from: State, to: State): MarkerSlide[] {
    const before = from.turnManager.turnOrder
    const after = to.turnManager.turnOrder
    return before
        .filter((playerId) => after.includes(playerId))
        .map((playerId) => ({
            playerId,
            from: turnOrderMarkerPoint(before, playerId),
            to: turnOrderMarkerPoint(after, playerId)
        }))
        .filter((slide) => slide.from.x !== slide.to.x)
}

// The round under way; none once the game has ended (R-6.1).
function roundUnderWay(state: State): number | undefined {
    return state.roundManager.currentRound?.number
}

// R-2.5.2: the round marker's step, when the transition moves it from one round to another.
export function roundStep(from: State, to: State): { from: number; to: number } | undefined {
    const before = roundUnderWay(from)
    const after = roundUnderWay(to)
    return before === undefined || after === undefined || before === after
        ? undefined
        : { from: before, to: after }
}

// R-2.5.3, R-1.4: the railroads the round's step makes available.
export function railroadsMadeAvailable(from: State, to: State): RailroadId[] {
    const step = roundStep(from, to)
    if (!step || step.to < step.from) return []
    return RAILROAD_INTRODUCTIONS[to.mapId]
        .filter(
            ({ availableFromRound }) =>
                availableFromRound > step.from && availableFromRound <= step.to
        )
        .map(({ railroadId }) => railroadId)
}
