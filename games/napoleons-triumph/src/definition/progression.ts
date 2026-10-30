import {
    HydratedTurnManager,
    type GameProgress,
    type GameProgression,
    type Round
} from '@tabletop/common'
import { Side } from '../components/pieces.js'
import { ROUNDS, isLastRound, roundDefinition, roundLabel } from '../components/timeTrack.js'
import type { NapoleonsTriumphProjectedState } from '../model/gameState.js'

export class NapoleonsTriumphProgression implements GameProgression<NapoleonsTriumphProjectedState> {
    progress(state: NapoleonsTriumphProjectedState): GameProgress {
        const latest = state.rounds.series.at(-1)
        if (latest === undefined) return { fraction: 0, label: 'Setup' }
        const round = latest.number - 1
        const lastRound = isLastRound(state.scenario, round)
        const clock = roundLabel(roundDefinition(state.scenario, round), true)
        return {
            fraction: (round + this.sharePlayed(state, latest)) / ROUNDS[state.scenario].length,
            label: lastRound ? `${clock} · Last hour` : clock,
            ...(lastRound ? { final: true } : {})
        }
    }

    private sharePlayed(state: NapoleonsTriumphProjectedState, latest: Round): number {
        if (latest.end !== undefined) return 1
        const turn = new HydratedTurnManager(state.turnManager).currentTurn()
        const side = state.players.find((player) => player.playerId === turn?.playerId)?.side
        return side === Side.French ? 0.5 : 0
    }
}
