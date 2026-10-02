import { EighteenXXTransferTiming, assetOwner, type TransferRules } from '@tabletop/18xx'
import { isLiquidated } from './liquidation.js'

// Companies trade trains by agreement, but not with a liquidated company; privates pass to
// companies only at formation.
export const EighteenSeventeenTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    canPurchase(state, companyId, asset) {
        const owner = assetOwner(state, asset)
        return (
            EighteenXXTransferTiming.canPurchase(state, companyId, asset) &&
            !(owner?.kind === 'company' && isLiquidated(state.stockMarket, owner.companyId))
        )
    },
    priceRange: (_state, _companyId, asset) =>
        asset.kind === 'train' ? { minimum: 1 } : undefined,
    afterPurchase: () => {}
}
