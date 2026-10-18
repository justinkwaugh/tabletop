import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { blocksBases } from './anomalies.js'
import { atBaseLimit } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { SettlementReward } from './pieces.js'
import { addSettlements } from './settling.js'

export type RewardPlacement = Type.Static<typeof RewardPlacement>
export const RewardPlacement = Type.Object({
    systemId: Type.String(),
    settlements: Type.Number()
})

// Rulebook 1.16 (Splinter Colony, Dissidents): settlements go to any of the Player's bases, or
// found a base in the anomaly's system if that keeps within the base limit, habitability
// ignored; never where a "no bases" anomaly stops bases gaining settlements.
export function rewardPlacementSystems(state: HydratedStellarHorizonsGameState): string[] {
    const reward = state.settlementRewards.at(0)
    assertExists(reward, 'No settlement reward is waiting')
    return placementSystems(state, reward)
}

function placementSystems(
    state: HydratedStellarHorizonsGameState,
    reward: SettlementReward
): string[] {
    const bases = state.basesOf(reward.playerId).map((base) => base.systemId)
    const canFound = !bases.includes(reward.systemId) && !atBaseLimit(state, reward.playerId)
    return (canFound ? [...bases, reward.systemId] : bases).filter(
        (systemId) => !blocksBases(state, systemId)
    )
}

// Settlements with nowhere to go are lost.
export function discardUnplaceableRewards(state: HydratedStellarHorizonsGameState) {
    state.settlementRewards = state.settlementRewards.filter(
        (reward) => placementSystems(state, reward).length > 0
    )
}

export function isValidRewardPlacement(
    state: HydratedStellarHorizonsGameState,
    placements: readonly RewardPlacement[]
): boolean {
    const reward = state.settlementRewards.at(0)
    if (!reward) {
        return false
    }
    const allowed = rewardPlacementSystems(state)
    const systems = placements.map((placement) => placement.systemId)
    return (
        new Set(systems).size === systems.length &&
        placements.every(
            (placement) =>
                allowed.includes(placement.systemId) &&
                Number.isInteger(placement.settlements) &&
                placement.settlements > 0
        ) &&
        placements.reduce((total, placement) => total + placement.settlements, 0) ===
            reward.settlements
    )
}

export function placeRewardSettlements(
    state: HydratedStellarHorizonsGameState,
    placements: readonly RewardPlacement[]
) {
    const reward = state.settlementRewards.at(0)
    assertExists(reward, 'No settlement reward is waiting')
    for (const placement of placements) {
        addSettlements(state, reward.playerId, placement.systemId, placement.settlements)
    }
    state.settlementRewards = state.settlementRewards.slice(1)
}
