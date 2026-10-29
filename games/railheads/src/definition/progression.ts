import type { GameProgress, GameProgression } from '@tabletop/common'
import { HydratedRailheadsGameState, type RailheadsProjectedState } from '../model/gameState.js'

export class RailheadsProgression implements GameProgression<RailheadsProjectedState> {
    progress(data: RailheadsProjectedState): GameProgress {
        const state = new HydratedRailheadsGameState(data)
        const round = state.round()
        if (round === 0) return { fraction: 0, label: 'Opening auction' }
        const { rounds, roundTimer } = state.edition.definition
        // The final round is shortened by the shares unsold, and shortened again as they sell, so
        // its share is measured against a full round: the cut counts as played and never shrinks.
        const fullRound = roundTimer[state.playerCount]
        const fraction = (round - 1 + (fullRound - state.roundTimer) / fullRound) / rounds
        const left = `${state.roundTimer} left`
        return state.isFinalRound()
            ? { fraction, label: `Last round · ${left}`, final: true }
            : { fraction, label: `Round ${round} of ${rounds} · ${left}` }
    }
}
