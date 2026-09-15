import { FinanceExampleTransferTiming, privateOwner, type TransferRules } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'
export const TheOldPrinceTransferRules: TransferRules = {
    ...FinanceExampleTransferTiming,
    priceRange(state, companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        const phase = TheOldPrincePhases.indexOf(state.phaseId)
        return asset.privateCompanyId === 'HS' &&
            companyId !== 'PEIR' &&
            phase >= 2 &&
            phase < TheOldPrincePhases.indexOf('4+') &&
            privateOwner(state, 'HS')?.kind === 'player'
            ? { minimum: 1, maximum: 200 }
            : undefined
    },
    afterPurchase: () => {}
}
