import type { HydratedEighteenSeventeenState } from '../state.js'

import { prepareFinalOperatingTurn } from '@tabletop/18xx/scenarios'
export function prepareEighteenSeventeenEnding(state: HydratedEighteenSeventeenState): void {
    state.gameEnding = { reason: 'Final operating set', finalOperatingSet: 1 }
    prepareFinalOperatingTurn(state)
}
