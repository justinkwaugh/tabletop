import { EighteenSeventeenCharters } from './charters.js'
import { EighteenXXTransferTiming, assetOwner, type TransferRules } from '@tabletop/18xx'
import { EighteenSeventeenCompanyMarket } from './marketZones.js'

// Companies trade trains by agreement, but not with a liquidated company; privates pass to
// companies only at formation.
export const EighteenSeventeenTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: EighteenSeventeenCharters,
    canPurchase(state, companyId, asset) {
        const owner = assetOwner(state, EighteenSeventeenCharters, asset)
        return (
            EighteenXXTransferTiming.canPurchase(state, companyId, asset) &&
            !(
                owner?.kind === 'company' &&
                EighteenSeventeenCompanyMarket.isLiquidated(state.stockMarket, owner.companyId)
            )
        )
    },
    priceRange: (_state, _companyId, asset) =>
        asset.kind === 'train' ? { minimum: 1 } : undefined,
    afterPurchase: () => {}
}
