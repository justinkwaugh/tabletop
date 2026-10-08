import type { GameScoring } from '@tabletop/common'
import type { HcgGameState } from '../model/gameState.js'

export class HcgScoring implements GameScoring<HcgGameState> {
    finalScores(state: HcgGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.cash]))
    }
}
