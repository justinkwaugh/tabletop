import { MachineState } from '@tabletop/ride-the-rails'
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
    /** Its desktop card, which the end of round brightens. */
    entryKey: string
    /** The desktop card's and the phone build pile's accessible name. */
    label: string
}

/**
 * Contract, The table: the railroads available this round (R-1.4) as the desktop cards and the
 * phone's share buttons show them. The round, the supply and the shares tick ahead of the shown state as
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
            label: railroadCardLabel(shown)
        }
    })
}

/** A desktop card's accessible name: the pile shows its supply as cubes, so the name says it in words. */
export function railroadCardLabel(card: RailroadCard): string {
    return `${railroadStyle(card.railroadId).name}: ${supplyText(card.supply)}`
}

export type ShareButton = ShownRailroadCard & {
    /** The viewer's shares of it, drawn as dots. */
    held: number
    /** Whether the viewer may take a share of it now (R-3.1). */
    enabled: boolean
    shareLabel: string
}

/**
 * Contract, Take a share: one button per railroad available this round, its pile with no words;
 * an empty one stays, disabled. What the viewer holds and may take come from the session.
 */
export function shareButtons(
    cards: readonly ShownRailroadCard[],
    session: Pick<RideTheRailsGameSession, 'myPlayerId' | 'shareChoices'>
): ShareButton[] {
    return cards.map((card) => {
        const held =
            card.shareholders.find((holding) => holding.playerId === session.myPlayerId)?.shares ??
            0
        return {
            ...card,
            held,
            enabled: session.shareChoices.includes(card.railroadId),
            shareLabel: shareButtonLabel(card, held)
        }
    })
}

/**
 * A share button's accessible name: the whole choice the wordless pile stands for, "Take a Red
 * share, 16 left, you hold 1", or "Red: none left" once its supply is empty.
 */
export function shareButtonLabel(card: RailroadCard, held: number): string {
    const name = railroadStyle(card.railroadId).name
    const holding = held > 0 ? `, you hold ${held}` : ''
    if (card.supply === 0) return `${name}: none left${holding}`
    const article = /^[AEIOU]/.test(name) ? 'an' : 'a'
    return `Take ${article} ${name} share, ${card.supply} left${holding}`
}

/**
 * Contract, Take a share: the deciding seat's phase 1, when the action area shows Take a share and
 * the desktop railroad cards are the share buttons.
 */
export function choosingShare(
    session: Pick<RideTheRailsGameSession, 'isMyTurn' | 'isViewingHistory' | 'gameState'>
): boolean {
    const state = session.gameState
    return (
        session.isMyTurn &&
        !session.isViewingHistory &&
        !state.result &&
        state.machineState === MachineState.TakingShares
    )
}
