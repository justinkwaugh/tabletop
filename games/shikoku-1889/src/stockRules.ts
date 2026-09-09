import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    getCompany,
    playersAfterPresident,
    type StockRules
} from '@tabletop/18xx'

export const Shikoku1889StockRules: StockRules = {
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.floated) return 'Only floated companies are available in this example.'
        if (certificate.president) return 'Starting a company is not available in this example.'
        if (
            certificate.owner.kind !== 'bank' ||
            (certificate.poolId !== 'initial-offering' && certificate.poolId !== 'open-market')
        )
            return 'This certificate is not available for purchase.'
        const price =
            certificate.poolId === 'initial-offering'
                ? company.parPrice
                : companyMarketSpace(state.stockMarket, company.id).price
        assertExists(price, 'An available 1889 share requires its purchase price')
        return { price: price * certificate.shares, recipient: certificate.owner, payers: [buyer] }
    },
    saleTerms(state, companyId, shares) {
        const company = getCompany(state, companyId)
        if (state.stockRound.number === 1) return 'Shares cannot be sold in the first stock round.'
        if (!company.shareCount || !company.president) return 'This company has no saleable shares.'
        return {
            payer: { kind: 'bank' },
            price: companyMarketSpace(state.stockMarket, companyId).price,
            destinationPoolId: 'open-market',
            marketLimit: 50,
            maximumShares: company.shareCount,
            movement: shares
        }
    },
    certificateLimit: () => 19,
    certificateWeight(state, certificate) {
        if (certificate.kind === 'share') {
            const color = companyMarketSpace(state.stockMarket, certificate.companyId).color
            if (color === 'yellow' || color === 'orange') return 0
        }
        return certificate.certificateLimitCount
    },
    ownershipLimit(state, companyId) {
        const company = getCompany(state, companyId)
        if (!company.shareCount) return 100
        return companyMarketSpace(state.stockMarket, companyId).color === 'orange' ? 100 : 60
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    sellAfterBuying: true
}
