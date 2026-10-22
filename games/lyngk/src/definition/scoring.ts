import type { GameScoring } from '@tabletop/common'
import { HydratedLyngkGameState, type LyngkGameState } from '../model/gameState.js'

export class LyngkScoring implements GameScoring<LyngkGameState> {
    finalScores(state: LyngkGameState): Record<string, number> {
        const hydrated = new HydratedLyngkGameState(state)
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, hydrated.scoreOf(player.playerId)])
        )
    }
}
