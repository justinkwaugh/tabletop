import type { GameProgress, GameProgression } from '@tabletop/common'
import { RAILROADS } from '../components/railroads.js'
import { CONNECTIONS_TO_END } from '../model/endCheck.js'
import type { OstbahnGameState } from '../model/gameState.js'
import { directConnections } from '../model/network.js'

export class OstbahnProgression implements GameProgression<OstbahnGameState> {
    progress(state: OstbahnGameState): GameProgress {
        const round = state.rounds.series.length
        if (round === 0) {
            return { fraction: 0, label: 'Opening auctions' }
        }
        const made = state.railroads.reduce(
            (sum, railroad) =>
                sum +
                Math.min(
                    CONNECTIONS_TO_END,
                    directConnections(state.railroads, railroad.id).length
                ),
            0
        )
        const needed = CONNECTIONS_TO_END * RAILROADS.length
        return {
            fraction: made / needed,
            label: `Round ${round} · ${made} of ${needed} connections`
        }
    }
}
