import type { GameScoring } from '@tabletop/common'
import type { BridgesGameState } from '../model/gameState.js'

export class BridgesScoring implements GameScoring<BridgesGameState> {
    finalScores(state: BridgesGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
