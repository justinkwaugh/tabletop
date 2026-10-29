import type { GameProgress, GameProgression } from '@tabletop/common'
import { FINAL_ROUND } from '../actions/completeRest.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { endDieIsRolled, endDieThreshold } from '../util/victory.js'

export class OathProgression implements GameProgression<OathProjectedState> {
    progress(data: OathProjectedState): GameProgress {
        const state = new HydratedOathGameState(data)
        const turnsPlayed = this.turnsTakenThisRound(state) / state.turnManager.turnOrder.length
        const lastRound = state.round === FINAL_ROUND
        return {
            fraction: (state.round - 1 + turnsPlayed) / FINAL_ROUND,
            label: lastRound ? 'Last round' : this.roundLabel(state),
            ...(lastRound ? { final: true } : {})
        }
    }

    private roundLabel(state: HydratedOathGameState): string {
        const threshold = endDieThreshold(state.round)
        return threshold !== undefined && endDieIsRolled(state)
            ? `Round ${state.round} · end die ${threshold}+`
            : `Round ${state.round} of ${FINAL_ROUND}`
    }

    private turnsTakenThisRound(state: HydratedOathGameState): number {
        const order = state.turnManager.turnOrder
        const current = state.turnManager.currentTurn()
        if (current) return order.indexOf(current.playerId)
        const last = state.turnManager.lastPlayer()
        return last === undefined ? 0 : order.indexOf(last) + 1
    }
}
