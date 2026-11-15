import type { GameProgress, GameProgression } from '@tabletop/common'
import type { MagnaGreciaProjectedState } from '../model/gameState.js'

export class MagnaGreciaProgression implements GameProgression<MagnaGreciaProjectedState> {
    progress(state: MagnaGreciaProjectedState): GameProgress {
        const turnsPlayed = state.turnIndex / state.turnManager.turnOrder.length
        const roundNumber = state.round + 1
        const lastRound = roundNumber === state.roundCount
        return {
            fraction: (state.round + turnsPlayed) / state.roundCount,
            label: lastRound ? 'Last round' : `Round ${roundNumber} of ${state.roundCount}`,
            ...(lastRound ? { final: true } : {})
        }
    }
}
