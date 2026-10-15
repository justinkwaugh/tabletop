import type { GameScoring } from '@tabletop/common'
import type { ZertzGameState } from '../model/gameState.js'
import { totalMarbles } from '../model/marbles.js'

export class ZertzScoring implements GameScoring<ZertzGameState> {
    finalScores(state: ZertzGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, totalMarbles(player.captured)])
        )
    }
}
