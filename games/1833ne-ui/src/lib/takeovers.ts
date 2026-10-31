import {
    isAnswerTakeover,
    isEndTakeoverStep,
    isOfferTakeover,
    isPassTakeover,
    isStartTakeoverStep,
    mergedTrainDiscards,
    redemptionTerms,
    takeoverDecision,
    type State1833NE,
    type TakeoverOffer,
    type TakeoverOutcome
} from '@tabletop/1833ne'
import { isDiscardMergedTrain, type Owner } from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    trainCount,
    type AwaitedDecision,
    type HistoryDescription,
    type MoneyFormat
} from '@tabletop/18xx-ui'

export type TakeoverNames = {
    companyName(companyId: string): string
    companyInitials(companyId: string): string
    playerName(playerId: string): string
    money: MoneyFormat
}

export function holderName(holder: Owner, names: Pick<TakeoverNames, 'playerName'>): string {
    return holder.kind === 'player' ? names.playerName(holder.playerId) : 'Stock Market'
}

/** A stable key for a holder of shares: a player or the Stock Market. */
export function holderKey(holder: Owner): string {
    return holder.kind === 'player' ? holder.playerId : 'market'
}

/** An offer in words: the shares swapped, by holder, and the cash. */
export function offerText(state: State1833NE, offer: TakeoverOffer, names: TakeoverNames): string {
    const terms = redemptionTerms(state, offer)
    const acquirer = names.companyInitials(offer.companyId)
    const swaps = offer.swaps.map(
        (swap) => `${swap.shares} ${acquirer} to ${holderName(swap.holder, names)}`
    )
    return [
        ...(swaps.length ? [`swapping ${swaps.join(', ')}`] : []),
        ...(terms.cash ? [`paying ${names.money(terms.cash)} for the rest`] : [])
    ].join(' and ')
}

export function awaitedTakeover(
    state: State1833NE,
    names: TakeoverNames
): AwaitedDecision | undefined {
    const decision = takeoverDecision(state)
    if (!decision) return undefined
    const initials = names.companyInitials
    if (decision.kind === 'answer') {
        const { offer } = decision
        return {
            title: 'Takeover offer',
            companyId: offer.targetId,
            text: `${initials(offer.companyId)} offers to take over ${initials(offer.targetId)}, ${offerText(state, offer, names)}; ${names.playerName(decision.playerId)} may accept or refuse`
        }
    }
    if (decision.kind === 'discard') {
        const discards = mergedTrainDiscards(state, decision.playerId)
        assertExists(discards, 'An acquirer over its limit has trains to turn in')
        return {
            title: 'Excess trains',
            companyId: decision.companyId,
            text: `${names.companyName(decision.companyId)} must turn in ${trainCount(discards.excess)}`
        }
    }
    return {
        title: 'Takeovers',
        companyId: decision.companyId,
        text: `${names.playerName(decision.playerId)} decides whether ${initials(decision.companyId)} attempts a takeover`
    }
}

function outcomeDescription(outcome: TakeoverOutcome, names: TakeoverNames): HistoryDescription {
    const swapped = outcome.redeemed.reduce(
        (sum, holding) => sum + holding.swappedCertificateIds.length,
        0
    )
    const paid = outcome.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const parts = [
        ...(swapped ? [`${swapped} ${swapped === 1 ? 'share' : 'shares'} swapped`] : []),
        ...(paid ? [`${names.money(paid)} paid`] : []),
        ...(outcome.removedTrainId ? ['a phase IV train removed'] : [])
    ]
    return {
        text: `${names.companyName(outcome.acquirerId)} took over ${names.companyName(outcome.targetId)}`,
        ...(parts.length ? { detail: parts.join(', ') } : {}),
        omitActor: true,
        important: true
    }
}

export function describeTakeoverAction(
    action: GameAction,
    names: TakeoverNames
): HistoryDescription | undefined {
    if (isStartTakeoverStep(action) || isEndTakeoverStep(action))
        return { text: 'Takeovers', routine: true, omitActor: true }
    if (isPassTakeover(action))
        return { text: `passed on a takeover for ${names.companyInitials(action.companyId)}` }
    if (isOfferTakeover(action)) {
        const outcome = action.metadata?.outcome
        if (outcome) return outcomeDescription(outcome, names)
        return {
            text: `offered that ${names.companyInitials(action.companyId)} take over ${names.companyInitials(action.targetId)}`
        }
    }
    if (isAnswerTakeover(action)) {
        const outcome = action.metadata?.outcome
        if (outcome) return outcomeDescription(outcome, names)
        return { text: action.accept ? 'accepted the takeover' : 'refused the takeover' }
    }
    if (isDiscardMergedTrain(action)) return { text: 'turned in a train after the takeover' }
    return undefined
}
