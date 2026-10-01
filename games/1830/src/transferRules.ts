import { EighteenThirtyPrivateCatalog } from './privates.js'
import { EighteenThirtyPhases } from './trains.js'
import { EighteenXXTransferTiming, privateOwner, type TransferRules } from '@tabletop/18xx'
export const EighteenThirtyTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        return EighteenThirtyPhases.isAtLeast(state.phaseId, '3') &&
            !EighteenThirtyPhases.isAtLeast(state.phaseId, '5') &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? EighteenThirtyPrivateCatalog.priceRange(asset.privateCompanyId)
            : undefined
    },
    afterPurchase: () => {}
}
