import { assertExists } from '@tabletop/common'
import {
    existingSharePurchaseRestriction,
    getCompany,
    type SharePurchaseRules
} from '@tabletop/18xx'

export const Shikoku1889SharePurchaseRules: SharePurchaseRules = {
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    terms(state, certificate, buyer) {
        const restriction = existingSharePurchaseRestriction(state, certificate, buyer)
        if (restriction) return restriction
        if (
            certificate.owner.kind !== 'bank' ||
            (certificate.poolId !== 'initial-offering' && certificate.poolId !== 'open-market')
        )
            return 'This certificate is not available for purchase.'
        const company = getCompany(state, certificate.companyId)
        const price =
            certificate.poolId === 'initial-offering' ? company.parPrice : company.marketPrice
        assertExists(price, 'An available 1889 share requires its purchase price')
        return { price: price * certificate.shares, recipient: certificate.owner, payers: [buyer] }
    },
    certificateLimit: () => 19,
    ownershipLimit: () => 60
}
