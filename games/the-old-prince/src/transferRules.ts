import { EighteenXXTransferTiming, privateOwner, type TransferRules } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'
export const TheOldPrinceTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    priceRange(state, companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        return asset.privateCompanyId === 'HS' &&
            companyId !== 'PEIR' &&
            TheOldPrincePhases.isAtLeast(state.phaseId, '4H') &&
            !TheOldPrincePhases.isAtLeast(state.phaseId, '4+') &&
            privateOwner(state, 'HS')?.kind === 'player'
            ? { minimum: 1, maximum: 200 }
            : undefined
    },
    afterPurchase: () => {}
}
