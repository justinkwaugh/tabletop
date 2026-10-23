import {
    isCompanyPurchaseOffer,
    type EighteenXXState,
    type Owner,
    type PendingPurchaseOffer,
    type PhaseChangeState,
    type TrainRules
} from '@tabletop/18xx'
import type { MoneyFormat } from '../presentation/money.js'
import { pendingDiscard } from '../session/discardModule.svelte.js'

export type AwaitedDecision = {
    title: string
    companyId?: string
    text: string
}

export type AwaitedDecisionNames = {
    companyName(companyId: string): string
    ownerName(owner: Owner): string
    trainName(trainId: string): string
    money: MoneyFormat
}

export type AwaitedDecisionState = PhaseChangeState &
    Pick<EighteenXXState, 'machineState' | 'trackConsent' | 'purchaseOffer'>

export function trainCount(count: number): string {
    return count === 1 ? '1 train' : `${count} trains`
}

export function awaitedDecision(
    state: AwaitedDecisionState,
    names: AwaitedDecisionNames,
    trainRules: Pick<TrainRules, 'trainLimit' | 'countsForLimit'>
): AwaitedDecision | undefined {
    if (state.trackConsent) {
        const { companyId, locationId, cost } = state.trackConsent.details
        return {
            title: 'Track permission',
            companyId,
            text: `${names.companyName(companyId)} asks to lay track at ${locationId}${cost ? ` for ${names.money(cost)}` : ''}`
        }
    }
    const offer = state.purchaseOffer
    if (offer)
        return {
            title: 'Purchase offer',
            ...(isCompanyPurchaseOffer(offer) ? { companyId: offer.buyer.companyId } : {}),
            text: purchaseOfferText(offer, names)
        }
    const discard =
        state.machineState === 'DiscardingTrains' ? pendingDiscard(state, trainRules) : undefined
    if (discard)
        return {
            title: 'Excess trains',
            companyId: discard.companyId,
            text: `${names.companyName(discard.companyId)} must discard ${trainCount(discard.excess)} to its limit of ${discard.limit}`
        }
    return undefined
}

export function purchaseOfferText(
    offer: PendingPurchaseOffer,
    names: AwaitedDecisionNames
): string {
    const buyer = isCompanyPurchaseOffer(offer)
        ? names.companyName(offer.buyer.companyId)
        : names.ownerName(offer.buyer)
    const asset =
        offer.asset.kind === 'private'
            ? names.companyName(offer.asset.privateCompanyId)
            : offer.asset.kind === 'company'
              ? names.companyName(offer.asset.companyId)
              : `${names.ownerName(offer.seller)}’s ${names.trainName(offer.asset.trainId)} train`
    return `${buyer} offers ${names.money(offer.price)} for ${asset}`
}
