import { assertExists, type GameScoring, type GameState } from '@tabletop/common'
import type { EighteenXXState } from '../game/eighteenXXState.js'

export const FinalWealthScoring: GameScoring<GameState & Pick<EighteenXXState, 'finalWealth'>> = {
    // A table's wealth level varies far more than the gaps between its places, so summed wealth
    // would mostly rank which tables a player sat at, and dollars behind would still lean on it.
    tiebreakRule: 'shareOfWinner',
    finalScores(state) {
        assertExists(state.finalWealth, 'Final scores require recorded final wealth')
        return Object.fromEntries(
            state.finalWealth.map((player) => [player.playerId, player.total])
        )
    }
}
