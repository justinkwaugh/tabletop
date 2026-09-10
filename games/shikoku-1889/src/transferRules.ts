import { privateOwner, type TransferRules } from '@tabletop/18xx'
const PrivateValues: Record<string, number> = {
    TE: 20,
    MF: 30,
    ER: 40,
    SRR: 50,
    DR: 60,
    PR: 80,
    UTF: 150
}
export const Shikoku1889TransferRules: TransferRules = {
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        const value = PrivateValues[asset.privateCompanyId]
        return ['3', '4'].includes(state.phaseId) &&
            value &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? { minimum: value / 2, maximum: value * 2 }
            : undefined
    },
    afterPurchase(state, offer) {
        if (
            offer.asset.kind === 'private' &&
            offer.asset.privateCompanyId === 'ER' &&
            !state.usedPrivatePowerIds.includes('ER')
        )
            state.privateTrackLay = {
                privateCompanyId: 'ER',
                companyId: offer.companyId,
                playerId: offer.sellerPlayerId
            }
    }
}
