import {
    fullCapitalizationPayments,
    presidentCertificate,
    sharesStillToFloat,
    stockMarketSpace,
    type CompanyRules
} from '@tabletop/18xx'

export const EighteenThirtyCompanyRules: CompanyRules = {
    startMarketSpaces: (state) =>
        state.stockMarket.spaces.filter((space) => space.color === 'pink').map((space) => space.id),
    startTerms(state, companyId, buyer, marketSpaceId) {
        const certificate = presidentCertificate(state, companyId)
        if (
            !certificate ||
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
    sharesToFloat: (state, companyId) =>
        sharesStillToFloat(
            state,
            companyId,
            60,
            (certificate) => certificate.poolId === 'initial-offering'
        ),
    flotationPayments: (state, companyId) =>
        fullCapitalizationPayments(
            state,
            companyId,
            EighteenThirtyCompanyRules.sharesToFloat?.(state, companyId)
        )
}
