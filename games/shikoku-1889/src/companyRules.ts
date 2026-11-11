import { Shikoku1889Charters } from './charters.js'
import { Shikoku1889Market } from './stockMarket.js'
import { fullCapitalizationCompanyRules } from '@tabletop/18xx'

export const Shikoku1889CompanyRules = fullCapitalizationCompanyRules({
    market: Shikoku1889Market,
    charters: Shikoku1889Charters,
    ipoPoolId: 'initial-offering',
    parSpaceColor: 'pink',
    floatPercent: 50
})
