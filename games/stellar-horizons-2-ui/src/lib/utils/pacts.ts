import {
    AnomalyChallenge,
    anomalyStrength,
    hasArrived,
    isClosed,
    isCrippled,
    pactTarget,
    type HydratedStellarHorizonsGameState,
    type PactShare,
    type PactTerms,
    type PactTargetKind,
    type ShipState
} from '@tabletop/stellar-horizons-2'

// What a pact is about, before its terms are chosen.
export interface PactSubject {
    targetKind: PactTargetKind
    targetId: string
    challenge: AnomalyChallenge
    systemId: string
}

export interface CandidateShip {
    ship: ShipState
    strength: number
}

// Ships everyone can see at the target that could take part: arrived, not crippled, with
// strength for the challenge. The proposer's own must also be unused in their Branch, which
// the pact rules check.
export function candidateShips(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    subject: PactSubject
): CandidateShip[] {
    return state
        .shipsOf(playerId)
        .filter(
            (ship) =>
                ship.systemId === subject.systemId &&
                hasArrived(ship) &&
                !isCrippled(ship) &&
                anomalyStrength(ship, subject.challenge) > 0
        )
        .map((ship) => ({ ship, strength: anomalyStrength(ship, subject.challenge) }))
}

// The Players a pact could name: others in the exploration span, still exploring, with ships
// at the target.
export function candidatePartners(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    subject: PactSubject
): string[] {
    const span = state.parallelSpan
    if (!span) {
        return []
    }
    return state
        .initiativeOrder()
        .filter(
            (candidate) =>
                candidate !== playerId &&
                span.playerIds.includes(candidate) &&
                !isClosed(state, candidate) &&
                candidateShips(state, candidate, subject).length > 0
        )
}

export const SHARE_ITEMS = ['influence', 'cash', 'markers', 'settlements'] as const

export function emptyShare(): PactShare {
    return { influence: 0, cash: 0, markers: 0, settlements: 0 }
}

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

export function targetReward(
    state: HydratedStellarHorizonsGameState,
    subject: PactSubject,
    partnerIds: readonly string[]
): { reward: PactShare; difficulty: number } | undefined {
    const terms: PactTerms = {
        targetKind: subject.targetKind,
        targetId: subject.targetId,
        challenge: subject.challenge,
        partnerIds: [...partnerIds],
        pledges: {},
        shares: {}
    }
    const target = pactTarget(state, terms)
    return target ? { reward: target.reward, difficulty: target.difficulty } : undefined
}
