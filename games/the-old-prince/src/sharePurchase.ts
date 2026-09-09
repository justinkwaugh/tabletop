import { assertExists } from '@tabletop/common'
import {
    existingSharePurchaseRestriction,
    getCompany,
    privateOwner,
    sameOwner,
    type Owner,
    type SharePurchaseRules
} from '@tabletop/18xx'

export const TheOldPrinceSharePurchaseRules: SharePurchaseRules = {
    buyers(state, playerId) {
        const player: Owner = { kind: 'player', playerId }
        const buyers: Owner[] = [player]
        const owner = privateOwner(state, 'UB')
        if (owner && sameOwner(owner, player) && !state.stockRound.companyPurchases.includes('UB'))
            buyers.push({ kind: 'company', companyId: 'UB' })
        return buyers
    },
    terms(state, certificate, buyer) {
        const restriction = existingSharePurchaseRestriction(state, certificate, buyer)
        if (restriction) return restriction
        if (certificate.shares !== 1) return 'Only one ordinary share can be bought on this turn.'
        const market = certificate.owner.kind === 'bank' && certificate.poolId === 'market'
        const treasury =
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === certificate.companyId &&
            certificate.poolId === `treasury:${certificate.companyId}`
        if (!market && !treasury) return 'This certificate is not available for purchase.'
        const price = getCompany(state, certificate.companyId).marketPrice
        assertExists(price, 'An available TOP share requires a market price')
        const payers: Owner[] = [buyer]
        if (buyer.kind === 'company') {
            const owner = privateOwner(state, buyer.companyId)
            assertExists(owner, 'Union Bank requires an owner')
            if (owner.kind !== 'player') return 'Union Bank requires a player owner.'
            payers.push(owner)
        }
        return { price, recipient: certificate.owner, payers }
    },
    certificateLimit: () => 20,
    ownershipLimit: () => 60
}
