import { assertExists, type GameScoring } from '@tabletop/common'
import type { EighteenXXState } from '../game/eighteenXXState.js'

export const FinalWealthScoring: GameScoring<EighteenXXState> = {
    finalScores(state) {
        assertExists(state.finalWealth, 'Final scores require recorded final wealth')
        return Object.fromEntries(
            state.finalWealth.map((player) => [player.playerId, player.total])
        )
    }
}
