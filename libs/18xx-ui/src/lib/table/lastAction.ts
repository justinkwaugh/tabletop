import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    isBuyAuctionLot,
    isBuyPrivateTrain,
    isBuyTrain,
    isCompanyPurchaseOffer,
    isDistributeEarnings,
    isFinishOperatingTurn,
    isIssueTreasuryShares,
    isLayTile,
    isOfferPurchase,
    isPlacePrivateStation,
    isPlaceStation,
    isPrivateTileLay,
    isRespondToPurchaseOffer,
    isRespondToTrackConsent,
    isRunTrains,
    isSellFundingShares,
    isStartOperatingTurn,
    type DistributeEarnings,
    type Owner
} from '@tabletop/18xx'
import type { MoneyFormat } from '../presentation/money.js'
import { isTreasuryPayment, paymentsInDisplayOrder } from '../earnings/earningsPayments.js'
import {
    afterPlayerName,
    joinDetails,
    startsWithCompanyLabel,
    type HistoryDescription
} from './historyDescription.js'
import { isAutomaticStockDecision, isHistoryBookkeeping } from './historyNavigation.js'

export type LastActionCredit =
    { kind: 'company'; companyId: string } | { kind: 'player'; playerId: string }

export type LastActionPrice = { connective: 'for' | '·' | ''; amount: string }

export function lastNotableStep(
    actions: readonly GameAction[],
    routine: (action: GameAction) => boolean
): GameAction[] {
    const notable = (action: GameAction) => !isHistoryBookkeeping(action) && !routine(action)
    const last = actions.findLastIndex(notable)
    if (last < 0) return []
    const start = actions.findLastIndex(
        (action, index) =>
            index <= last &&
            (action.source === ActionSource.User || isAutomaticStockDecision(action))
    )
    return actions.slice(Math.max(0, start), last + 1).filter(notable)
}

export function operatingTurnCompany(
    actions: readonly GameAction[],
    action: GameAction
): string | undefined {
    for (let index = actions.indexOf(action); index >= 0; index--) {
        const earlier = actions[index]
        if (isStartOperatingTurn(earlier)) return earlier.companyId
        if (isFinishOperatingTurn(earlier)) return undefined
    }
    return undefined
}

export function companyActedFor(action: GameAction): string | undefined {
    if (isSellFundingShares(action)) return undefined
    if (isIssueTreasuryShares(action)) {
        assertExists(action.metadata, 'Recorded share issue requires its settlement')
        const seller = action.metadata.seller
        return seller.kind === 'company' ? seller.companyId : undefined
    }
    if (isRespondToPurchaseOffer(action)) {
        assertExists(action.metadata, 'Recorded purchase response requires its offer')
        const { offer, accepted } = action.metadata
        return accepted && isCompanyPurchaseOffer(offer) ? offer.buyer.companyId : undefined
    }
    return 'companyId' in action && typeof action.companyId === 'string'
        ? action.companyId
        : undefined
}

export function lastActionCredit(
    actions: readonly GameAction[],
    action: GameAction,
    description: HistoryDescription
): LastActionCredit | undefined {
    const companyId = companyActedFor(action)
    if (companyId && companyId === operatingTurnCompany(actions, action))
        return { kind: 'company', companyId }
    const decidedByPlayer = action.source === ActionSource.User || isAutomaticStockDecision(action)
    return action.playerId && decidedByPlayer && !description.omitActor
        ? { kind: 'player', playerId: action.playerId }
        : undefined
}

export function creditedSentence(
    text: string,
    actor: string | undefined,
    companyLabels: readonly string[]
): { actor?: string; text: string } {
    return actor && !startsWithCompanyLabel(text, companyLabels)
        ? { actor, text: afterPlayerName(text, companyLabels) }
        : { text }
}

function isPurchase(action: GameAction): boolean {
    return (
        isLayTile(action) ||
        isPrivateTileLay(action) ||
        isRespondToTrackConsent(action) ||
        isPlaceStation(action) ||
        isBuyTrain(action) ||
        isBuyPrivateTrain(action) ||
        isOfferPurchase(action) ||
        isRespondToPurchaseOffer(action) ||
        isBuyAuctionLot(action)
    )
}

export function lastActionPrice(
    action: GameAction,
    description: HistoryDescription
): LastActionPrice | undefined {
    if (!description.value) return undefined
    if (isPlacePrivateStation(action) || (isPlaceStation(action) && !action.expectedCost))
        return { connective: 'for', amount: 'free' }
    if (isPurchase(action) || isRunTrains(action))
        return { connective: 'for', amount: description.value }
    return { connective: isDistributeEarnings(action) ? '' : '·', amount: description.value }
}

export function payoutRecipients(
    payout: DistributeEarnings,
    ownerName: (owner: Owner) => string,
    money: MoneyFormat
): string | undefined {
    assertExists(payout.metadata, 'Recorded dividend requires its settlement')
    return joinDetails(
        ...paymentsInDisplayOrder(payout.metadata.payments, payout.companyId).map(
            (payment) =>
                `${isTreasuryPayment(payment.to, payout.companyId) ? 'Treasury' : ownerName(payment.to)} ${money(payment.amount)}`
        )
    )
}
