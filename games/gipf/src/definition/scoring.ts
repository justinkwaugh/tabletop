import type { GameScoring } from '@tabletop/common'
import type { GipfGameState } from '../model/gameState.js'

export class GipfScoring implements GameScoring<GipfGameState> {
    finalScores(state: GipfGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.captured]))
    }
}
