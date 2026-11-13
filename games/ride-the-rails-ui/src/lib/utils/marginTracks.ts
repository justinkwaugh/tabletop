import {
    RAILROAD_INTRODUCTIONS,
    ROUND_COUNT,
    supplyOf,
    trackCount,
    type HydratedRideTheRailsGameState,
    type RailroadId
} from '@tabletop/ride-the-rails'

export type Shareholding = {
    playerId: string
    shares: number
}

export type RailroadStripEntry = {
    railroadId: RailroadId
    availableFromRound: number
    available: boolean
    supply: number
    trackCount: number
    shareholders: Shareholding[]
}

export type RoundStop = {
    round: number
    current: boolean
    newRailroadIds: RailroadId[]
}

export type TurnOrderStop = {
    playerId: string
    position: number
    money: number
}

/** "1st", "2nd", "3rd", "4th", "5th": a seat's place in turn order. */
export function ordinal(position: number): string {
    const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'
    return `${position}${suffix}`
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

export function romanRound(round: number): string {
    return ROMAN_NUMERALS[round - 1] ?? String(round)
}

// R-2.1, R-6.1: the round the table shows; once round 6 ends the game no round is current, so
// the last one stays on show.
export function shownRoundNumber(state: HydratedRideTheRailsGameState): number {
    return state.roundManager.currentRound?.number ?? state.roundManager.series.at(-1)?.number ?? 1
}

// R-1.1, R-1.1-H1, R-1.4: one entry per railroad in R-1.4 order, its supply from the logic package,
// dim until its round; shareholders in turn order.
export function railroadStrip(state: HydratedRideTheRailsGameState): RailroadStripEntry[] {
    const round = shownRoundNumber(state)
    const turnOrder = state.turnManager.turnOrder
    return RAILROAD_INTRODUCTIONS[state.mapId].map(({ railroadId, availableFromRound }) => ({
        railroadId,
        availableFromRound,
        available: availableFromRound <= round,
        supply: supplyOf(state, railroadId),
        trackCount: trackCount(state.track, railroadId),
        shareholders: turnOrder
            .map((playerId) => ({
                playerId,
                shares: state.getPlayerState(playerId).sharesOf(railroadId)
            }))
            .filter((holding) => holding.shares > 0)
    }))
}

// R-1.4, R-2.1: rounds I-VI, each with the railroads it makes available.
export function roundTrack(state: HydratedRideTheRailsGameState): RoundStop[] {
    const currentRound = shownRoundNumber(state)
    const introductions = RAILROAD_INTRODUCTIONS[state.mapId]
    return Array.from({ length: ROUND_COUNT }, (_, index) => {
        const round = index + 1
        return {
            round,
            current: round === currentRound,
            newRailroadIds: introductions
                .filter((introduction) => introduction.availableFromRound === round)
                .map((introduction) => introduction.railroadId)
        }
    })
}

// R-2.3, R-2.5: the turn manager's order, with each seat's money.
export function turnOrderTrack(state: HydratedRideTheRailsGameState): TurnOrderStop[] {
    return state.turnManager.turnOrder.map((playerId, index) => ({
        playerId,
        position: index + 1,
        money: state.getPlayerState(playerId).money
    }))
}
