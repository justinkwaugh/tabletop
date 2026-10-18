import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { atBaseLimit } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { addSettlements } from './settling.js'

export type RewardPlacement = Type.Static<typeof RewardPlacement>
export const RewardPlacement = Type.Object({
    systemId: Type.String(),
    settlements: Type.Number()
})

// Rulebook 1.16 (Splinter Colony, Dissidents): settlements go to any of the Player's bases, or
// found a base in the anomaly's system if that keeps within the base limit, habitability
// ignored.
export function rewardPlacementSystems(state: HydratedStellarHorizonsGameState): string[] {
    const reward = state.settlementReward
    assertExists(reward, 'No settlement reward is waiting')
    const bases = state.basesOf(reward.playerId).map((base) => base.systemId)
    const canFound = !bases.includes(reward.systemId) && !atBaseLimit(state, reward.playerId)
    return canFound ? [...bases, reward.systemId] : bases
}

export function isValidRewardPlacement(
    state: HydratedStellarHorizonsGameState,
    placements: readonly RewardPlacement[]
): boolean {
    const reward = state.settlementReward
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
    const reward = state.settlementReward
    assertExists(reward, 'No settlement reward is waiting')
    for (const placement of placements) {
        addSettlements(state, reward.playerId, placement.systemId, placement.settlements)
    }
    state.settlementReward = undefined
}
