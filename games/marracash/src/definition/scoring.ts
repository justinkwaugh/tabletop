import { assertExists, type GameScoring } from '@tabletop/common'
import type { MarracashProjectedState } from '../model/gameState.js'

export class MarracashScoring implements GameScoring<MarracashProjectedState> {
    finalScores(state: MarracashProjectedState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => {
                assertExists(player.money, `Player ${player.playerId}'s cash is not known`)
                return [player.playerId, player.money]
            })
        )
    }
}
