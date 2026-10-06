import { fullCapitalizationCompanyRules, type CompanyRules } from '@tabletop/18xx'

export const EighteenThirtyCompanyRules: CompanyRules = {
    ...fullCapitalizationCompanyRules({
        ipoPoolId: 'initial-offering',
        parSpaceColor: 'pink',
        floatPercent: 60
    }),
    parAfterAward: true
}
