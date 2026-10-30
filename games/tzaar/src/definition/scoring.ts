import type { GameScoring } from '@tabletop/common'
import { HydratedTzaarGameState, type TzaarGameState } from '../model/gameState.js'

// TZAAR has no score; each player's tally is the opponent's pieces they captured.
export class TzaarScoring implements GameScoring<TzaarGameState> {
    finalScores(state: TzaarGameState): Record<string, number> {
        const hydrated = new HydratedTzaarGameState(state)
        return Object.fromEntries(
            hydrated.players.map((player) => [
                player.playerId,
                hydrated.capturedBy(player.playerId)
            ])
        )
    }
}
