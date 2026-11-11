import type { GameProgress, GameProgression } from '@tabletop/common'
import { RoofCount } from '../components/roofBag.js'
import type { EstatesProjectedState } from '../model/gameState.js'

export class EstatesProgression implements GameProgression<EstatesProjectedState> {
    progress(state: EstatesProjectedState): GameProgress {
        const remaining = state.roofs.remaining
        const lastRoof = remaining === 0
        return {
            fraction: (RoofCount - remaining) / RoofCount,
            label: lastRoof
                ? 'Last roof'
                : `${remaining} ${remaining === 1 ? 'roof' : 'roofs'} left`,
            ...(lastRoof ? { final: true } : {})
        }
    }
}
