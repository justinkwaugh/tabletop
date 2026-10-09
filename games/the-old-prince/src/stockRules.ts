import { TheOldPrinceMarket } from './stockMarket.js'
import { TheOldPrinceStockRoundRules } from './roundRules.js'
import { assertExists } from '@tabletop/common'
import {
    getCompany,
    marketSaleTerms,
    playersAfterPresident,
    privateOwner,
    sameOwner,
    type Owner,
    type StockState,
    type StockRules,
    standardCertificateWeight
} from '@tabletop/18xx'

export const TheOldPrinceStockRules: StockRules = {
    market: TheOldPrinceMarket,
    round: TheOldPrinceStockRoundRules,
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
        if (!company.started || company.closed) return 'This company has not started or is closed.'
        if (certificate.president) return 'Starting a company is not available in this example.'
        if (certificate.shares !== 1) return 'Only one ordinary share can be bought on this turn.'
        const market = certificate.owner.kind === 'bank' && certificate.poolId === 'market'
        const treasury =
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === company.id &&
            certificate.poolId === `treasury:${company.id}`
        if (!market && !treasury) return 'This certificate is not available for purchase.'
        return {
            price: TheOldPrinceMarket.companySpace(state.stockMarket, company.id).price,
            recipient: certificate.owner,
            payers: theOldPrincePurchasePayers(state, buyer)
        }
    },
    saleTerms(state, companyId) {
        const company = getCompany(state, companyId)
        if (companyId === 'PEIR' || !company.shareCount || !company.president)
            return 'This company has no saleable shares.'
        if (!company.operated) return 'Shares cannot be sold until the company has operated.'
        return marketSaleTerms(TheOldPrinceMarket, state, companyId, {
            destinationPoolId: 'market',
            marketLimit: 80,
            maximumShares: company.shareCount * 0.3,
            movement: 1
        })
    },
    certificateLimit: (state) => (state.players.length === 4 ? 16 : 20),
    certificateWeight: (_state, certificate) => standardCertificateWeight(certificate),
    ownershipLimit: () => 60,
    presidencyCandidates(state, companyId) {
        return [
            ...playersAfterPresident(state, companyId, state.turnManager.turnOrder),
            { kind: 'company', companyId: 'UB' }
        ]
    },
    turnOrder: 'sell-buy',
    repeatSales: 'extend-block'
}

export function theOldPrincePurchasePayers(state: StockState, buyer: Owner): Owner[] {
    if (buyer.kind !== 'company') return [buyer]
    const owner = privateOwner(state, buyer.companyId)
    assertExists(owner, 'Union Bank requires an owner')
    return [buyer, owner]
}
