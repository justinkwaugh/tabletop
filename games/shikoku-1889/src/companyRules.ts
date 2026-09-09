import { assertExists } from '@tabletop/common'
import { getCompany, certificatesInPool, stockMarketSpace, type CompanyRules } from '@tabletop/18xx'

export const Shikoku1889CompanyRules: CompanyRules = {
    startMarketSpaces: (state) =>
        state.stockMarket.spaces.filter((space) => space.color === 'pink').map((space) => space.id),
    startTerms(state, companyId, buyer, marketSpaceId) {
        const certificate = state.certificates.find(
            (certificate) =>
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.president &&
                certificate.companyId === companyId
        )
        if (
            !certificate ||
            certificate.retired ||
            certificate.owner.kind !== 'bank' ||
            certificate.poolId !== 'initial-offering'
        )
            return 'The president’s certificate must be available in the IPO.'
        return {
            price: stockMarketSpace(state.stockMarket, marketSpaceId).price * 2,
            recipient: { kind: 'bank' },
            payers: [buyer]
        }
    },
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        if (!company.shareCount) return undefined
        const unsold = certificatesInPool(state, 'initial-offering').reduce(
            (sum, certificate) =>
                sum +
                (certificate.kind === 'share' && certificate.companyId === companyId
                    ? certificate.shares
                    : 0),
            0
        )
        if (unsold * 100 > company.shareCount * 50) return undefined
        assertExists(company.parPrice, 'Started company requires a par price')
        return company.funded
            ? []
            : [
                  {
                      from: { kind: 'bank' },
                      to: { kind: 'company', companyId },
                      amount: company.parPrice * 10
                  }
              ]
    }
}
