import { assertExists, type GameAction } from '@tabletop/common'
import {
    HydratedClaimDealKept,
    openDealsOf,
    otherPartyOf,
    type HydratedOathGameState,
    type OpenDeal
} from '@tabletop/oath'
import { endingRecord } from '$lib/model/majorEvents.js'
import { plural } from '$lib/model/names.js'

/** R-7.6.3-H1 — the promise a party made in a deal; none when they promised nothing. */
export function promiseBy(deal: OpenDeal, playerId: string): string | undefined {
    if (deal.proposerPlayerId === playerId) return deal.proposerPromise
    if (deal.counterpartyPlayerId === playerId) return deal.counterpartyPromise
    return undefined
}

/** The name pill's mark: how many deals the seat is party to ("1 deal", "2 deals"). */
export function dealCount(count: number): string {
    return plural(count, 'deal')
}

/** R-7.6.3-H1 — one of Resolve Tribunal's rows: the deal, its other party, and whether it may be claimed kept now. */
export interface TribunalDealRow {
    deal: OpenDeal
    otherPlayerId: string
    canAsk: boolean
}

/**
 * R-7.6.3-H1 — Resolve Tribunal's rows, one per open deal the seat is party to. "Ask" is offered
 * where the engine takes the claim: not for a deal already claimed kept this turn.
 */
export function tribunalDealRows(
    state: HydratedOathGameState,
    playerId: string,
    claimOffered: boolean
): TribunalDealRow[] {
    return openDealsOf(state, playerId).map((deal) => {
        const otherPlayerId = otherPartyOf(deal, playerId)
        assertExists(otherPlayerId, 'a deal the seat is party to has another party')
        const canAsk =
            claimOffered &&
            HydratedClaimDealKept.reasonCannotClaim(state, playerId, deal.id) === undefined
        return { deal, otherPlayerId, canAsk }
    })
}

/** R-7.6.3-H1 — a promise as the end-of-game row quotes it, or that the party promised nothing. */
export function quotedPromise(text: string | undefined): string {
    return text === undefined ? 'nothing promised' : `"${text}"`
}

/** R-7.6.3-H1 — the deals still open when the game ended, as the ending action recorded and dropped them. */
export function droppedDeals(actions: readonly GameAction[]): OpenDeal[] {
    return endingRecord(actions)?.openDealsDropped ?? []
}
