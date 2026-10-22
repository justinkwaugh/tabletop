import {
    ConsentingRedemptionState,
    EighteenThirtyTwoMarket,
    MergingState,
    ProtectingPriceState,
    declinedMarketSpaceId,
    mergedTrainDiscards,
    mergerDecision,
    mergerTerms,
    protectionDecision,
    takeoverShortfall,
    type EighteenThirtyTwoState
} from '@tabletop/1832'
import { trainCount, type AwaitedDecision, type MoneyFormat } from '@tabletop/18xx-ui'

export type EighteenThirtyTwoDecisionNames = {
    companyName(companyId: string): string
    companyInitials(companyId: string): string
    playerName(playerId: string): string
    money: MoneyFormat
}

export function protectionTerms(state: EighteenThirtyTwoState) {
    const record = state.priceProtection
    const decision =
        state.machineState === ProtectingPriceState ? protectionDecision(state) : undefined
    if (!record || !decision) return undefined
    return {
        ...decision.sale,
        sellerPlayerId: record.sellerPlayerId,
        presidentPlayerId: decision.playerId,
        price: EighteenThirtyTwoMarket.companySpace(state.stockMarket, decision.sale.companyId)
            .price,
        declinedPrice: EighteenThirtyTwoMarket.space(declinedMarketSpaceId(state, decision.sale))
            .price
    }
}

export function mergedDiscardTerms(state: EighteenThirtyTwoState, playerId: string) {
    const discards = mergedTrainDiscards(state, playerId)
    return discards && { ...discards, limit: discards.trains.length - discards.excess }
}

export function awaitedDecision1832(
    state: EighteenThirtyTwoState,
    names: EighteenThirtyTwoDecisionNames
): AwaitedDecision | undefined {
    if (state.machineState === ProtectingPriceState) return protection(state, names)
    if (state.machineState === ConsentingRedemptionState && state.redemptionRequest) {
        const { companyId, holderPlayerId, price } = state.redemptionRequest
        return {
            title: 'Share redemption',
            companyId,
            text: `${names.companyName(companyId)} asks to redeem one of ${names.playerName(holderPlayerId)}’s shares for ${names.money(price)}`
        }
    }
    if (state.machineState === MergingState) return merger(state, names)
    return undefined
}

function protection(
    state: EighteenThirtyTwoState,
    names: EighteenThirtyTwoDecisionNames
): AwaitedDecision | undefined {
    const terms = protectionTerms(state)
    if (!terms) return undefined
    const shares = `${terms.shares} ${names.companyInitials(terms.companyId)} ${terms.shares === 1 ? 'share' : 'shares'}`
    return {
        title: 'Price protection',
        companyId: terms.companyId,
        text: `${names.playerName(terms.sellerPlayerId)} sold ${shares} for ${names.money(terms.proceeds)}. ${names.playerName(terms.presidentPlayerId)} may buy ${terms.shares === 1 ? 'it' : 'them'} to keep the price at ${names.money(terms.price)}${terms.declinedPrice === terms.price ? '' : `, or let it drop to ${names.money(terms.declinedPrice)}`}`
    }
}

function merger(
    state: EighteenThirtyTwoState,
    names: EighteenThirtyTwoDecisionNames
): AwaitedDecision | undefined {
    const decision = mergerDecision(state)
    const initials = names.companyInitials
    if (decision?.kind === 'answer') {
        const { proposal } = decision
        const terms = mergerTerms(state, proposal, proposal.proposerPlayerId)
        const proposer = names.playerName(proposal.proposerPlayerId)
        return {
            title: 'Merger proposal',
            companyId: proposal.companyId,
            text:
                terms.kind === 'system'
                    ? `${proposer} proposes forming a System of ${initials(proposal.companyId)} and ${initials(proposal.partnerId)} at ${names.money(terms.price)}, ${names.playerName(terms.president)} presiding`
                    : `${proposer} proposes that ${initials(terms.buyerId)} take over ${initials(terms.targetId)}, paying ${names.money(terms.price)} for its shares`
        }
    }
    const funding = state.mergerPhase?.funding
    if (decision?.kind === 'fund' && funding) {
        const shortfall = takeoverShortfall(
            state,
            funding.buyerId,
            funding.targetId,
            funding.playerId
        )
        return {
            title: 'Takeover funding',
            companyId: funding.buyerId,
            text: `${names.playerName(funding.playerId)} sells shares to raise ${names.money(shortfall)} for ${initials(funding.buyerId)}’s takeover of ${initials(funding.targetId)}`
        }
    }
    const discards =
        decision?.kind === 'discard' ? mergedDiscardTerms(state, decision.playerId) : undefined
    if (discards)
        return {
            title: 'Excess trains',
            companyId: discards.companyId,
            text: `${names.companyName(discards.companyId)} must discard ${trainCount(discards.excess)} to its limit of ${discards.limit}`
        }
    return undefined
}
