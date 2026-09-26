import type { GameScoring } from '@tabletop/common'
import type { SolProjectedState } from '../model/gameState.js'

// Sol's terminal handler ranks players solely by momentum; ties share the victory.
export class SolScoring implements GameScoring<SolProjectedState> {
    finalScores(state: SolProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.momentum]))
    }
}
