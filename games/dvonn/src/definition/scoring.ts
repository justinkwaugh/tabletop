import type { GameScoring } from '@tabletop/common'
import { HydratedDvonnGameState, type DvonnGameState } from '../model/gameState.js'

// Rule G2: each player scores every piece in the stacks they control, DVONN pieces included.
export class DvonnScoring implements GameScoring<DvonnGameState> {
    finalScores(state: DvonnGameState): Record<string, number> {
        const hydrated = new HydratedDvonnGameState(state)
        return Object.fromEntries(
            hydrated.players.map((player) => [player.playerId, hydrated.score(player.playerId)])
        )
    }
}
