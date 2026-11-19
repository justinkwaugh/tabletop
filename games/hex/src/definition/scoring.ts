import type { GameScoring } from '@tabletop/common'
import type { HexGameState } from '../model/gameState.js'

export class HexScoring implements GameScoring<HexGameState> {
    finalScores(state: HexGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
