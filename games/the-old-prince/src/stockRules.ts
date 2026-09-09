import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    getCompany,
    playersAfterPresident,
    privateOwner,
    sameOwner,
    type Owner,
    type StockRules
} from '@tabletop/18xx'

export const TheOldPrinceStockRules: StockRules = {
    buyers(state, playerId) {
        const player: Owner = { kind: 'player', playerId }
        const buyers: Owner[] = [player]
        const owner = privateOwner(state, 'UB')
        if (owner && sameOwner(owner, player) && !state.stockRound.companyPurchases.includes('UB'))
            buyers.push({ kind: 'company', companyId: 'UB' })
        return buyers
    },
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.floated) return 'Only floated companies are available in this example.'
        if (certificate.president) return 'Starting a company is not available in this example.'
        if (certificate.shares !== 1) return 'Only one ordinary share can be bought on this turn.'
        const market = certificate.owner.kind === 'bank' && certificate.poolId === 'market'
        const treasury =
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === company.id &&
            certificate.poolId === `treasury:${company.id}`
        if (!market && !treasury) return 'This certificate is not available for purchase.'
        const payers: Owner[] = [buyer]
        if (buyer.kind === 'company') {
            const owner = privateOwner(state, buyer.companyId)
            assertExists(owner, 'Union Bank requires an owner')
            if (owner.kind !== 'player') return 'Union Bank requires a player owner.'
            payers.push(owner)
        }
        return {
            price: companyMarketSpace(state.stockMarket, company.id).price,
            recipient: certificate.owner,
            payers
        }
    },
    saleTerms(state, companyId) {
        const company = getCompany(state, companyId)
        if (companyId === 'PEIR' || !company.shareCount || !company.president)
            return 'This company has no saleable shares.'
        if (!company.operated) return 'Shares cannot be sold until the company has operated.'
        return {
            payer: { kind: 'bank' },
            price: companyMarketSpace(state.stockMarket, companyId).price,
            destinationPoolId: 'market',
            marketLimit: 80,
            maximumShares: company.shareCount * 0.3,
            movement: 1
        }
    },
    certificateLimit: () => 20,
    certificateWeight: (_state, certificate) => certificate.certificateLimitCount,
    ownershipLimit: () => 60,
    presidencyCandidates(state, companyId) {
        return [
            ...playersAfterPresident(state, companyId, state.turnManager.turnOrder),
            { kind: 'company', companyId: 'UB' }
        ]
    },
    sellAfterBuying: false
}
