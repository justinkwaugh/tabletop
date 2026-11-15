import type { GameProgress, GameProgression } from '@tabletop/common'
import { EntranceFountainIds } from '../components/board.js'
import { startingQueueLength } from '../components/visitors.js'
import type { MarracashProjectedState } from '../model/gameState.js'

const startingQueue = startingQueueLength(EntranceFountainIds.length)

export class MarracashProgression implements GameProgression<MarracashProjectedState> {
    progress(state: MarracashProjectedState): GameProgress {
        const waiting = state.queue.length
        return {
            fraction: (startingQueue - waiting) / startingQueue,
            label: state.finalRound
                ? 'Final round'
                : `${waiting} ${waiting === 1 ? 'visitor' : 'visitors'} waiting`,
            ...(state.finalRound ? { final: true } : {})
        }
    }
}
