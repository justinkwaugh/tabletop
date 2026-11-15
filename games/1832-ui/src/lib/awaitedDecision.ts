import {
    MergingState,
    mergedTrainDiscards,
    mergerDecision,
    mergerTerms,
    takeoverShortfall,
    type EighteenThirtyTwoState
} from '@tabletop/1832'
import { trainCount, type AwaitedDecision, type ShareActionNames } from '@tabletop/18xx-ui'

export function mergedDiscardTerms(state: EighteenThirtyTwoState, playerId: string) {
    const discards = mergedTrainDiscards(state, playerId)
    return discards && { ...discards, limit: discards.trains.length - discards.excess }
}

export function awaitedDecision1832(
    state: EighteenThirtyTwoState,
    names: ShareActionNames
): AwaitedDecision | undefined {
    if (state.machineState === MergingState) return merger(state, names)
    return undefined
}

function merger(
    state: EighteenThirtyTwoState,
    names: ShareActionNames
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
