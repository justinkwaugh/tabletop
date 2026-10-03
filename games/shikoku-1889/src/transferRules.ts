import {
    EighteenXXTransferTiming,
    privateOwner,
    privatePowerUsed,
    type TransferRules
} from '@tabletop/18xx'
import { Shikoku1889PrivateCatalog } from './privates.js'
import { Shikoku1889Phases } from './trains.js'
export const Shikoku1889TransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        return Shikoku1889Phases.isAtLeast(state.phaseId, '3') &&
            !Shikoku1889Phases.isAtLeast(state.phaseId, '5') &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? Shikoku1889PrivateCatalog.priceRange(asset.privateCompanyId)
            : undefined
    },
    afterPurchase(state, offer) {
        if (
            offer.asset.kind === 'private' &&
            offer.asset.privateCompanyId === 'ER' &&
            !privatePowerUsed(state, 'ER')
        )
            state.privateTrackLay = {
                privateCompanyId: 'ER',
                companyId: offer.companyId,
                playerId: offer.sellerPlayerId
            }
    }
}
