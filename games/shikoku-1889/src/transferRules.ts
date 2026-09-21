import { Shikoku1889Privates } from './privates.js'
import { EighteenXXTransferTiming, privateOwner, type TransferRules } from '@tabletop/18xx'
export const Shikoku1889TransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        const value = Shikoku1889Privates.find((item) => item.id === asset.privateCompanyId)?.price
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
