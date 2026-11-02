import type { GameScoring, TiebreakRule } from '@tabletop/common'
import type { FreshFishProjectedState } from '../model/gameState.js'

export class FreshFishScoring implements GameScoring<FreshFishProjectedState> {
    // Money is spent, never earned, so a table's score level reflects how hard it bid.
    readonly tiebreakRule: TiebreakRule = 'pointsBehind'

    finalScores(state: FreshFishProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
