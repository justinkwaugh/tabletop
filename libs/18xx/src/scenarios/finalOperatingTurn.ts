import { assert } from '@tabletop/common'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'

export function prepareFinalOperatingTurn(state: HydratedEighteenXXState): void {
    const set = state.operatingSet
    const companyId = state.trainPurchaseStep?.companyId
    assert(
        set && companyId && state.gameEnding?.finalOperatingSet,
        'Final turn example requires a scheduled ending and operator'
    )
    set.number = state.gameEnding.finalOperatingSet
    set.roundNumber = set.roundCount
    set.completedCompanyIds = set.companyOrder.filter((id) => id !== companyId)
}
