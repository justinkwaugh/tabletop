import type { GameProgress, GameProgression } from '@tabletop/common'
import type { SolProjectedState } from '../model/gameState.js'
import { STARTING_INSTABILITY } from '../utils/solConstants.js'

export class SolProgression implements GameProgression<SolProjectedState> {
    progress(state: SolProjectedState): GameProgress {
        const lastFlare = state.instability <= 1
        return {
            fraction: (STARTING_INSTABILITY - state.instability) / STARTING_INSTABILITY,
            label: lastFlare ? 'Last flare' : `Instability ${state.instability}`,
            ...(lastFlare ? { final: true } : {})
        }
    }
}
