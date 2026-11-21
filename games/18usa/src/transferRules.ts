import { EighteenXXTransferTiming, assetOwner, type TransferRules } from '@tabletop/18xx'
import { EighteenUSACharters } from './charters.js'
import { EighteenUSACompanyMarket } from './marketZones.js'
import { obsolete } from './trainRules.js'

// Companies trade trains by agreement for at least $1, but not with a liquidated company, nor an
// obsolete train (BGG rulings); privates pass to companies only at formation (§12.6, §7.1).
export const EighteenUSATransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: EighteenUSACharters,
    canPurchase(state, companyId, asset) {
        const owner = assetOwner(state, EighteenUSACharters, asset)
        if (asset.kind === 'train') {
            const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
            if (train && obsolete(train)) return false
        }
        return (
            EighteenXXTransferTiming.canPurchase(state, companyId, asset) &&
            !(
                owner?.kind === 'company' &&
                EighteenUSACompanyMarket.isLiquidated(state.stockMarket, owner.companyId)
            )
        )
    },
    priceRange: (_state, _companyId, asset) =>
        asset.kind === 'train' ? { minimum: 1 } : undefined,
    afterPurchase: () => {}
}
