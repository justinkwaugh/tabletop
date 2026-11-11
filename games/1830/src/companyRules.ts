import { EighteenThirtyCharters } from './charters.js'
import { EighteenThirtyMarket } from './stockMarket.js'
import { fullCapitalizationCompanyRules, type CompanyRules } from '@tabletop/18xx'

export const EighteenThirtyCompanyRules: CompanyRules = {
    ...fullCapitalizationCompanyRules({
        market: EighteenThirtyMarket,
        charters: EighteenThirtyCharters,
        ipoPoolId: 'initial-offering',
        parSpaceColor: 'pink',
        floatPercent: 60
    }),
    parAfterAward: true
}
