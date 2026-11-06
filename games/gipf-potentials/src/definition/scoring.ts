import type { GameScoring } from '@tabletop/common'
import type { GipfPotentialsGameState } from '../model/gameState.js'

export class GipfPotentialsScoring implements GameScoring<GipfPotentialsGameState> {
    finalScores(state: GipfPotentialsGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.captured]))
    }
}
