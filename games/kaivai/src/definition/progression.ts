import type { GameProgress, GameProgression } from '@tabletop/common'
import type { KaivaiProjectedState } from '../model/gameState.js'
import { PhaseName } from './phases.js'
import { MachineState } from './states.js'

const finalScoringStates = [
    MachineState.FinalScoring,
    MachineState.IslandBidding,
    MachineState.EndOfGame
]

export class KaivaiProgression implements GameProgression<KaivaiProjectedState> {
    progress(state: KaivaiProjectedState): GameProgress {
        const godMoves = state.phases.series.filter(
            (phase) => phase.name === PhaseName.MoveGod && phase.end !== undefined
        ).length
        const roundCount = state.cultTiles + godMoves
        const roundNumber = state.rounds.series.length
        const roundsPlayed = state.rounds.series.filter((round) => round.end !== undefined).length
        const finalScoring = finalScoringStates.includes(state.machineState)
        const lastRound = roundNumber === roundCount
        return {
            fraction: roundsPlayed / roundCount,
            label: finalScoring
                ? 'Final scoring'
                : lastRound
                  ? 'Last round'
                  : `Round ${roundNumber} of ${roundCount}`,
            ...(finalScoring || lastRound ? { final: true } : {})
        }
    }
}
