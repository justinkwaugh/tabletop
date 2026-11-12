import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { OpenDeal, PowerQuestionKind, QuestionOf } from '../model/question.js'
import { openDealsOf } from './exchange.js'

/** R-7.6.3-H1 — the other party to a deal, when the player is one of its two. */
export function otherPartyOf(deal: OpenDeal, playerId: string): string | undefined {
    if (deal.proposerPlayerId === playerId) return deal.counterpartyPlayerId
    if (deal.counterpartyPlayerId === playerId) return deal.proposerPlayerId
    return undefined
}

/** R-7.6.3-H1 — an open deal the player is party to, by its id. */
export function openDealOf(
    state: HydratedOathGameState,
    playerId: string,
    dealId: string
): OpenDeal | undefined {
    return openDealsOf(state, playerId).find((deal) => deal.id === dealId)
}

/**
 * R-7.6.3-H1 — the turn of the game in progress: its round and whose turn it is. A deal claimed in it
 * cannot be claimed again until another turn, by either party.
 */
export function turnOfTheGame(
    state: HydratedOathGameState
): { round: number; playerId: string } | undefined {
    const playerId = state.turnManager.currentTurn()?.playerId
    return playerId === undefined ? undefined : { round: state.round, playerId }
}

export function claimedThisTurn(state: HydratedOathGameState, deal: OpenDeal): boolean {
    const turn = turnOfTheGame(state)
    const claimed = deal.lastClaimedTurn
    return (
        turn !== undefined &&
        claimed !== undefined &&
        claimed.round === turn.round &&
        claimed.playerId === turn.playerId
    )
}

/** R-7.6.3-H1 — the deals left, or none at all once the last is closed, as before any deal. */
export function closeOpenDeal(state: HydratedOathGameState, dealId: string): void {
    const rest = (state.openDeals ?? []).filter((deal) => deal.id !== dealId)
    state.openDeals = rest.length > 0 ? rest : undefined
}

/**
 * R-7.6.3-H1 — a claim's question stands while its deal is open between the claimant and the asked
 * party; once it is not, the question is neither asked nor answered, as an offer's is not
 * (`reasonExchangeInvalid`).
 */
export function reasonDealKeptInvalid(
    state: HydratedOathGameState,
    question: QuestionOf<PowerQuestionKind.DealKept>
): string | undefined {
    const deal = openDealOf(state, question.claimantPlayerId, question.dealId)
    return deal && otherPartyOf(deal, question.claimantPlayerId) === question.askedPlayerId
        ? undefined
        : 'the deal is no longer open'
}

/**
 * R-7.6.3-H1 — the other party's word: kept closes the deal, not kept leaves it open. Either way the
 * answer records the deal as it stood, so the History reads it from the record.
 */
export function answerDealKept(
    state: HydratedOathGameState,
    question: QuestionOf<PowerQuestionKind.DealKept>,
    kept: boolean
): { summary: string; answeredDeal: OpenDeal } {
    const deal = openDealOf(state, question.claimantPlayerId, question.dealId)
    assertExists(deal, 'an answered claim names an open deal')
    const answeredDeal = { ...deal }
    if (!kept) {
        return {
            summary: `said the deal with ${question.claimantPlayerId} was not kept`,
            answeredDeal
        }
    }
    closeOpenDeal(state, question.dealId)
    return {
        summary: `confirmed the deal with ${question.claimantPlayerId} was kept`,
        answeredDeal
    }
}

/**
 * R-7.6.3-H1 — the game has ended: the deals still open go into the ending action's record and are
 * dropped, so the History lists them from the record and no finished table shows one open. A game
 * that ends with none records nothing.
 */
export function dropOpenDealsAtGameEnd(state: HydratedOathGameState): {
    openDealsDropped?: OpenDeal[]
} {
    const open = state.openDeals
    if (!open?.length) return {}
    state.openDeals = undefined
    return { openDealsDropped: open.map((deal) => ({ ...deal })) }
}
