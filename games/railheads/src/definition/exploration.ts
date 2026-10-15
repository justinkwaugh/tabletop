import type { ExplorationPopulation, GameExploration } from '@tabletop/common'
import type { RailheadsProjectedState } from '../model/gameState.js'

// A hypothetical game keeps every sealed bid the explorer knows and invents the rest: zero or a
// whole-dollar amount from the minimum up to that player's cash.
export class RailheadsGameExploration implements GameExploration<RailheadsProjectedState> {
    createFromCanonicalState(state: RailheadsProjectedState): RailheadsProjectedState {
        return structuredClone(state)
    }

    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<RailheadsProjectedState>): RailheadsProjectedState {
        const result = structuredClone(state)
        const auction = result.industryAuction
        if (!auction) {
            return result
        }
        for (const bid of auction.bids) {
            if (bid.amount !== undefined) continue
            const cash =
                result.players.find((player) => player.playerId === bid.playerId)?.cash ?? 0
            const choices = Math.max(0, cash - auction.minimum + 1)
            const pick = Math.floor(random() * (choices + 1))
            bid.amount = pick === 0 ? 0 : auction.minimum + pick - 1
        }
        return result
    }
}
