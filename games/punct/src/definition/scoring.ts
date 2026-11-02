import type { GameScoring } from '@tabletop/common'
import type { PunctGameState } from '../model/gameState.js'
import { HydratedPunctBoard } from '../model/board.js'

// The central spaces each player controls: the standard game's second goal.
export class PunctScoring implements GameScoring<PunctGameState> {
    finalScores(state: PunctGameState): Record<string, number> {
        const board = new HydratedPunctBoard(state.board)
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, board.centreCount(player.playerId)])
        )
    }
}
