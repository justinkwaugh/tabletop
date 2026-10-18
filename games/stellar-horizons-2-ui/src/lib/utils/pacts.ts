import {
    PactTargetKind,
    anomalyDefinition,
    emptyShare,
    eventDefinition,
    type Pact,
    type PactOpening,
    type PactShare,
    type PactSubject
} from '@tabletop/stellar-horizons-2'
import { plural } from './presentation.js'

export const SHARE_ITEMS = ['influence', 'cash', 'markers', 'settlements'] as const
export type ShareItem = (typeof SHARE_ITEMS)[number]

// An even split, with what does not divide going to the proposer.
export function evenShares(
    reward: PactShare,
    partnerIds: readonly string[],
    proposerId: string
): Record<string, PactShare> {
    const shares = Object.fromEntries(partnerIds.map((playerId) => [playerId, emptyShare()]))
    for (const item of SHARE_ITEMS) {
        const each = Math.floor(reward[item] / partnerIds.length)
        const remainder = reward[item] - each * partnerIds.length
        for (const playerId of partnerIds) {
            shares[playerId][item] = each + (playerId === proposerId ? remainder : 0)
        }
    }
    return shares
}

export function pactOpening(candidate: Pact): PactOpening {
    return {
        targetKind: candidate.terms.targetKind,
        targetId: candidate.terms.targetId,
        challenge: candidate.terms.challenge,
        systemId: candidate.systemId
    }
}

export function pactTargetName(subject: Pick<PactSubject, 'targetKind' | 'targetId'>): string {
    return subject.targetKind === PactTargetKind.Event
        ? eventDefinition(subject.targetId).name
        : anomalyDefinition(subject.targetId).name
}

export interface RewardParts {
    influence: number
    cash: number
    markers: string
    settlements: number
}

export function rewardSummary(parts: RewardParts): string {
    const listed = [
        parts.influence ? `${parts.influence} IP` : '',
        parts.cash ? `$${parts.cash}B` : '',
        parts.markers,
        parts.settlements ? plural(parts.settlements, 'settlement') : ''
    ].filter(Boolean)
    return listed.length > 0 ? listed.join(', ') : 'nothing'
}

export function shareText(share: PactShare): string {
    return rewardSummary({
        ...share,
        markers: share.markers ? plural(share.markers, 'marker') : ''
    })
}
