import type { GameProgress, GameProgression } from '@tabletop/common'
import type { SantiagoProjectedState } from '../model/gameState.js'
import { roundCount } from '../util/tileBag.js'

export class SantiagoProgression implements GameProgression<SantiagoProjectedState> {
    progress(state: SantiagoProjectedState): GameProgress {
        const rounds = roundCount(state.players.length)
        const round = Math.max(state.round, 1)
        const lastRound = round === rounds
        return {
            fraction: state.result === undefined ? (round - 1) / rounds : 1,
            label: lastRound ? 'Last round' : `Round ${round} of ${rounds}`,
            ...(lastRound ? { final: true } : {})
        }
    }
}
