import type { GameScoring } from '@tabletop/common'
import type { EstatesProjectedState } from '../model/gameState.js'
import { HydratedEstatesPlayerState } from '../model/playerState.js'

export class EstatesScoring implements GameScoring<EstatesProjectedState> {
    finalScores(state: EstatesProjectedState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                new HydratedEstatesPlayerState(player).getScore()
            ])
        )
    }
}
