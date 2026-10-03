import type { HydratedEighteenXXState } from '@tabletop/18xx'
import { prepareFinalOperatingTurn } from '@tabletop/18xx/scenarios'
export function prepareEighteenSeventeenEnding(state: HydratedEighteenXXState): void {
    state.gameEnding = { reason: 'Final operating set', finalOperatingSet: 1 }
    prepareFinalOperatingTurn(state)
}
