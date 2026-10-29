import type { GameProgress, GameProgression } from '@tabletop/common'
import { edition } from '../editions/editions.js'
import type { RailheadsProjectedState } from '../model/gameState.js'

export class RailheadsProgression implements GameProgression<RailheadsProjectedState> {
    progress(state: RailheadsProjectedState): GameProgress {
        const round = state.rounds.series.length
        if (round === 0) return { fraction: 0, label: 'Opening auction' }
        const { rounds, roundTimer } = edition(state.editionId).definition
        // The final round starts short by the shares left unsold; measuring it against a full
        // round counts that cut as played, so the bar jumps forward once instead of shrinking.
        const fullRound = roundTimer[state.players.length]
        const fraction = (round - 1 + (fullRound - state.roundTimer) / fullRound) / rounds
        const left = `${state.roundTimer} left`
        return round === rounds
            ? { fraction, label: `Last round · ${left}`, final: true }
            : { fraction, label: `Round ${round} of ${rounds} · ${left}` }
    }
}
