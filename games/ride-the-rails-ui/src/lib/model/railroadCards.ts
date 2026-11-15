import { ROUND_KEY, railroadEntryKey, sharesKey, supplyKey } from '$lib/animators/flights.svelte.js'
import {
    railroadCards,
    shownRoundNumber,
    supplyText,
    type RailroadCard
} from '$lib/utils/marginTracks.js'
import { railroadStyle } from '$lib/utils/railroadStyle.js'
import type { RideTheRailsGameSession } from './session.svelte.js'

export type ShownRailroadCard = RailroadCard & {
    /** Made available by the end of round under way: drawn unseen until it brightens in. */
    arriving: boolean
    /** Its card or rail pile, which the end of round brightens. */
    entryKey: string
    label: string
}

/**
 * Contract, The table: the railroads available this round (R-1.4) as the desktop cards and the
 * phone's rail show them. The round, the supply and the shares tick ahead of the shown state as
 * a flight lifts or lands, or as the end of a round steps (Animation plan).
 */
export function shownRailroadCards(session: RideTheRailsGameSession): ShownRailroadCard[] {
    const state = session.gameState
    const flights = session.flights
    const stateRound = shownRoundNumber(state)
    const round = flights.shown(ROUND_KEY, stateRound)
    const settled = new Set(railroadCards(state, stateRound).map((card) => card.railroadId))
    return railroadCards(state, round).map((card) => {
        const shown: RailroadCard = {
            ...card,
            supply: flights.shown(supplyKey(card.railroadId), card.supply),
            shareholders: card.shareholders.map((holding) => ({
                ...holding,
                shares: flights.shown(sharesKey(holding.playerId, card.railroadId), holding.shares)
            }))
        }
        return {
            ...shown,
            arriving: !settled.has(card.railroadId),
            entryKey: railroadEntryKey(card.railroadId),
            label: railroadCardLabel(shown, (playerId) => session.getPlayerName(playerId))
        }
    })
}

/** A card's accessible name: the pile shows its supply as cubes, so the name says it in words. */
export function railroadCardLabel(
    card: RailroadCard,
    nameOf: (playerId: string) => string
): string {
    const holders = card.shareholders
        .map((holding) => `${nameOf(holding.playerId)} ${holding.shares}`)
        .join(', ')
    const name = railroadStyle(card.railroadId).name
    return `${name}: ${supplyText(card.supply)}, ${card.trackCount} track${holders ? `, shares ${holders}` : ''}`
}
