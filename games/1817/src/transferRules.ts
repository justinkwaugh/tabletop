import { EighteenXXTransferTiming, type TransferRules } from '@tabletop/18xx'

// Companies trade trains by agreement; privates pass to companies only at formation.
export const EighteenSeventeenTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    priceRange: (_state, _companyId, asset) =>
        asset.kind === 'train' ? { minimum: 1 } : undefined,
    afterPurchase: () => {}
}
