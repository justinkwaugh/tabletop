import { assertExists, type GameScoring, type GameState } from '@tabletop/common'
import type { EighteenXXState } from '../game/eighteenXXState.js'

export const FinalWealthScoring: GameScoring<GameState & Pick<EighteenXXState, 'finalWealth'>> = {
    finalScores(state) {
        assertExists(state.finalWealth, 'Final scores require recorded final wealth')
        return Object.fromEntries(
            state.finalWealth.map((player) => [player.playerId, player.total])
        )
    }
}
