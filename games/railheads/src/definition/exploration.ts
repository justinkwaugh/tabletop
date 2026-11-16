import { assertExists, type ExplorationPopulation, type GameExploration } from '@tabletop/common'
import { edition } from '../editions/editions.js'
import type { RailheadsProjectedState } from '../model/gameState.js'

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
            const player = result.players.find((candidate) => candidate.playerId === bid.playerId)
            assertExists(player, 'A sealed bid must belong to a player')
            const mayBidZero = bid.playerId !== auction.investorId
            const { map } = edition(result.editionId)
            const stars = (player.tolls ?? []).reduce((sum, id) => sum + map.toll(id).stars, 0)
            const amounts = Math.max(0, player.cash + stars - auction.minimum + 1)
            const choice = Math.floor(random() * (amounts + (mayBidZero ? 1 : 0)))
            bid.amount =
                mayBidZero && choice === 0 ? 0 : auction.minimum + choice - (mayBidZero ? 1 : 0)
        }
        return result
    }
}
