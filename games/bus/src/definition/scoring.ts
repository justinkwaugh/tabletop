import type { GameScoring } from '@tabletop/common'
import type { BusGameState } from '../model/gameState.js'
import { finalScore } from '../model/playerState.js'

export class BusScoring implements GameScoring<BusGameState> {
    finalScores(state: BusGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, finalScore(player)])
        )
    }
}
