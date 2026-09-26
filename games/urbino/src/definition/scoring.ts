import type { GameScoring } from '@tabletop/common'
import type { UrbinoGameState } from '../model/gameState.js'

export class UrbinoScoring implements GameScoring<UrbinoGameState> {
    finalScores(state: UrbinoGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
