import { HydratedTurnManager, type GameProgress, type GameProgression } from '@tabletop/common'
import { FINAL_ROUND } from '../actions/completeRest.js'
import type { OathProjectedState } from '../model/gameState.js'
import { endDieIsRolled, endDieThreshold } from '../util/victory.js'

export class OathProgression implements GameProgression<OathProjectedState> {
    progress(state: OathProjectedState): GameProgress {
        // R-8 — once won, no round is left to play; the chronicle is written before the result.
        if (state.chronicle !== undefined) return { fraction: 1, label: 'Chronicle', final: true }
        const turns = new HydratedTurnManager(state.turnManager)
        const turnsPlayed = this.turnsTakenThisRound(turns) / turns.turnOrder.length
        const lastRound = state.round === FINAL_ROUND
        return {
            fraction: (state.round - 1 + turnsPlayed) / FINAL_ROUND,
            label: lastRound ? 'Last round' : this.roundLabel(state),
            ...(lastRound ? { final: true } : {})
        }
    }

    private roundLabel(state: OathProjectedState): string {
        const threshold = endDieThreshold(state.round)
        return threshold !== undefined && endDieIsRolled(state)
            ? `Round ${state.round} · end die ${threshold}+`
            : `Round ${state.round} of ${FINAL_ROUND}`
    }

    private turnsTakenThisRound(turns: HydratedTurnManager): number {
        const current = turns.currentTurn()
        if (current) return turns.turnOrder.indexOf(current.playerId)
        const last = turns.lastPlayer()
        return last === undefined ? 0 : turns.turnOrder.indexOf(last) + 1
    }
}
