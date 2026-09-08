import { assertExists, type ExplorationPopulation, type GameExploration } from '@tabletop/common'
import type { KaivaiProjectedState } from '../model/gameState.js'

export class KaivaiGameExploration implements GameExploration<KaivaiProjectedState> {
    createFromCanonicalState(state: KaivaiProjectedState): KaivaiProjectedState {
        return structuredClone(state)
    }

    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<KaivaiProjectedState>): KaivaiProjectedState {
        const result = structuredClone(state)
        for (const bid of result.scoringBids ?? []) {
            if (bid.amount !== undefined) continue
            const player = result.players.find((player) => player.playerId === bid.playerId)
            assertExists(player, 'A scoring bid must belong to a player')
            bid.amount = Math.floor(random() * (Math.floor(player.influence) + 1))
        }
        return result
    }
}
