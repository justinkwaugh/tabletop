import { assertExists, type GameScoring } from '@tabletop/common'
import type { DickeKartoffelnProjectedState } from '../model/gameState.js'

// Winning points: the places in the economy and ecology rankings.
export class DickeKartoffelnScoring implements GameScoring<DickeKartoffelnProjectedState> {
    finalScores(state: DickeKartoffelnProjectedState): Record<string, number> {
        const standings = state.standings
        assertExists(standings, 'Final scores exist once the game is scored')
        return Object.fromEntries(standings.map((standing) => [standing.playerId, standing.points]))
    }
}
