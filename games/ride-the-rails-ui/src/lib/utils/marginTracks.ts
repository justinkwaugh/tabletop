import {
    RAILROAD_INTRODUCTIONS,
    ROUND_COUNT,
    supplyOf,
    type HydratedRideTheRailsGameState,
    type MapId,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { railroadStyle } from './railroadStyle.js'

export type Shareholding = {
    playerId: string
    shares: number
}

export type RailroadCard = {
    railroadId: RailroadId
    supply: number
    shareholders: Shareholding[]
}

/** "1st", "2nd", "3rd", "4th", "5th": a seat's place in turn order. */
export function ordinal(position: number): string {
    const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'
    return `${position}${suffix}`
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

// R-1.1: a railroad's locomotives still off the map.
export function supplyText(supply: number): string {
    return supply > 0 ? `${supply} left` : 'none left'
}

export function romanRound(round: number): string {
    return ROMAN_NUMERALS[round - 1] ?? String(round)
}

export type RoundTicket = {
    round: number
    numeral: string
    /** The railroads the round makes available, in R-1.4 order. */
    arrivals: RailroadId[]
    /** Its accessible name: the round, and the railroads that arrive in it. */
    label: string
    /** The arrivals' colours; a round with none keeps the plain light ticket. */
    paint: TicketPaint | undefined
}

export type TicketPaint = {
    /** One railroad's colour, or the railroads side by side, left to right in R-1.4 order. */
    background: string
    /** The numeral's colour: one railroad's own ink, or light ink on a split. */
    ink: string
    /** A dark halo round a split's numeral, so it reads on every part of the fill. */
    halo: boolean
}

/** A ticket's fill and numeral for the railroads its round makes available (R-1.4). */
export function ticketPaint(arrivals: readonly RailroadId[]): TicketPaint | undefined {
    const styles = arrivals.map(railroadStyle)
    const first = styles[0]
    if (!first) return undefined
    const share = 100 / styles.length
    const background =
        styles.length === 1
            ? first.fill
            : `linear-gradient(90deg, ${styles
                  .map((style, index) => `${style.fill} ${index * share}% ${(index + 1) * share}%`)
                  .join(', ')})`
    // A split takes light ink with a dark halo, which reads on any pair of railroad colours.
    return styles.length === 1
        ? { background, ink: first.ink, halo: false }
        : { background, ink: 'var(--rtr-ink-light)', halo: true }
}

/** "Red", "Red and Blue", "Red, Blue and Orange". */
function listed(names: readonly string[]): string {
    return names.length > 1
        ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
        : names.join('')
}

// R-2.1, R-1.4: rounds I to VI, each with the railroads it makes available on the map, in their
// colours.
export function roundTickets(mapId: MapId): RoundTicket[] {
    return Array.from({ length: ROUND_COUNT }, (_, index): RoundTicket => {
        const round = index + 1
        const arrivals = RAILROAD_INTRODUCTIONS[mapId]
            .filter(({ availableFromRound }) => availableFromRound === round)
            .map(({ railroadId }) => railroadId)
        const names = arrivals.map((railroadId) => railroadStyle(railroadId).name)
        const arriving = names.length
            ? `, ${listed(names)} ${names.length > 1 ? 'arrive' : 'arrives'}`
            : ''
        return {
            round,
            numeral: romanRound(round),
            arrivals,
            label: `Round ${round}${arriving}`,
            paint: ticketPaint(arrivals)
        }
    })
}

// R-2.1, R-6.1: the round the table shows; once round 6 ends the game no round is current, so
// the last one stays on show.
export function shownRoundNumber(state: HydratedRideTheRailsGameState): number {
    return state.roundManager.currentRound?.number ?? state.roundManager.series.at(-1)?.number ?? 1
}

// R-1.1, R-1.4: one card per railroad available in `round` (the shown round, unless the
// end of a round has stepped ahead of the state), in R-1.4 order, its supply from the logic
// package; shareholders in turn order.
export function railroadCards(
    state: HydratedRideTheRailsGameState,
    round: number = shownRoundNumber(state)
): RailroadCard[] {
    const turnOrder = state.turnManager.turnOrder
    return RAILROAD_INTRODUCTIONS[state.mapId]
        .filter(({ availableFromRound }) => availableFromRound <= round)
        .map(({ railroadId }) => ({
            railroadId,
            supply: supplyOf(state, railroadId),
            shareholders: turnOrder
                .map((playerId) => ({
                    playerId,
                    shares: state.getPlayerState(playerId).sharesOf(railroadId)
                }))
                .filter((holding) => holding.shares > 0)
        }))
}
