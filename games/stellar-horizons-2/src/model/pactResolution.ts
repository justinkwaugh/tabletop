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
    return candidate.terms.partnerIds.map((playerId, index) => {
        const share = candidate.terms.shares[playerId]
        const granted = grantReward(state, playerId, {
            influence: share.influence,
            cash: share.cash,
            markers: field && share.markers > 0 ? { field, count: share.markers } : undefined,
            settlements: share.settlements,
            // Goods and cards cannot be split; they wait for slices 3 and 4 either way.
            ...(index === 0 ? { goods: anomaly.reward.goods, card: anomaly.reward.card } : {})
        })
        if (granted.settlements > 0) {
            state.settlementRewards.push({
                playerId,
                anomalyId: anomaly.id,
                systemId: candidate.systemId,
                settlements: granted.settlements
            })
        }
        state.getPlayerState(playerId).anomalies.push(anomaly.id)
        return granted
    })
}
