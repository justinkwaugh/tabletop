import { assertExists } from '@tabletop/common'
import { anomalyDefinition } from '../components/anomalies.js'
import { grantReward, type GrantedReward } from './anomalyRewards.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { PactTargetKind, type Pact } from './pieces.js'

// When the exploration span completes, each agreed pact joins the attempts at its earliest
// partner in initiative order, with every partner's pledged ships; offers never agreed are
// dropped.
export function queuePactAttempts(state: HydratedStellarHorizonsGameState) {
    const agreed = state.pacts.filter((candidate) => candidate.agreed)
    state.pacts = agreed
    for (const candidate of agreed) {
        const earliest = state
            .initiativeOrder()
            .find((playerId) => candidate.terms.partnerIds.includes(playerId))
        assertExists(earliest, 'A pact has partners')
        const shipIds = candidate.terms.partnerIds.flatMap(
            (playerId) => candidate.terms.pledges[playerId] ?? []
        )
        const player = state.getPlayerState(earliest)
        if (candidate.terms.targetKind === PactTargetKind.Anomaly) {
            player.anomalyAttempts.push({
                systemId: candidate.systemId,
                anomalyId: candidate.terms.targetId,
                shipIds,
                pactId: candidate.id
            })
        } else {
            player.eventAttempts.push({
                eventId: candidate.terms.targetId,
                systemId: candidate.systemId,
                challenge: candidate.terms.challenge,
                shipIds,
                pactId: candidate.id
            })
        }
    }
}

// The reward is split item by item as the pact's shares say; each partner counts the
// resolution as their own (rulebook 1.16, directives and titles).
export function grantPactShares(
    state: HydratedStellarHorizonsGameState,
    candidate: Pact
): GrantedReward[] {
    const anomaly = anomalyDefinition(candidate.terms.targetId)
    const field = anomaly.reward.markers?.field
    const good = anomaly.reward.goods?.good
    return candidate.terms.partnerIds.map((playerId, index) => {
        const share = candidate.terms.shares[playerId]
        const granted = grantReward(
            state,
            playerId,
            {
                influence: share.influence,
                cash: share.cash,
                markers: field && share.markers > 0 ? { field, count: share.markers } : undefined,
                settlements: share.settlements,
                goods: good && share.goods > 0 ? { good, count: share.goods } : undefined,
                // A card cannot be split; cards wait for slice 4 either way.
                ...(index === 0 ? { card: anomaly.reward.card } : {})
            },
            { anomalyId: anomaly.id, systemId: candidate.systemId }
        )
        state.getPlayerState(playerId).anomalies.push(anomaly.id)
        return granted
    })
}
