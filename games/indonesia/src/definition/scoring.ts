import type { GameScoring } from '@tabletop/common'
import type { IndonesiaGameState } from '../model/gameState.js'
import { totalMoney } from '../model/playerState.js'

export class IndonesiaScoring implements GameScoring<IndonesiaGameState> {
    finalScores(state: IndonesiaGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, totalMoney(player)])
        )
    }
}
