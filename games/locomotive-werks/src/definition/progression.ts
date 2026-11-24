import type { GameProgress, GameProgression } from '@tabletop/common'
import type { LwProjectedState } from '../model/gameState.js'
import { WINNING_CASH } from '../model/locomotives.js'

// The game ends once someone reaches $300 after taxes, so the richest player's cash measures it.
export class LwProgression implements GameProgression<LwProjectedState> {
    progress(state: LwProjectedState): GameProgress {
        const richest = Math.max(...state.players.map((player) => player.cash))
        const round = state.roundManager.series.length
        return {
            fraction: Math.min(1, richest / WINNING_CASH),
            label: `Round ${round} · Richest $${richest} of $${WINNING_CASH}`,
            ...(state.result ? { final: true as const } : {})
        }
    }
}
