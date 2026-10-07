import { fullCapitalizationCompanyRules, type CompanyRules } from '@tabletop/18xx'

const FullCapitalization = fullCapitalizationCompanyRules({
    ipoPoolId: 'initial-offering',
    parSpaceColor: 'pink',
    floatPercent: 60
})

export const EighteenThirtyTwoCompanyRules: CompanyRules = {
    ...FullCapitalization,
    // A company floats when its sixth share leaves the initial offering, but receives its capital
    // only as the stock round ends (§5.6.4).
    flotationPayments: (state, companyId) =>
        FullCapitalization.sharesToFloat?.(state, companyId) === 0 ? [] : undefined,
    parAfterAward: true
}
