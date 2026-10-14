import { Shikoku1889Market } from './stockMarket.js'
import { fullCapitalizationCompanyRules } from '@tabletop/18xx'

export const Shikoku1889CompanyRules = fullCapitalizationCompanyRules({
    market: Shikoku1889Market,
    ipoPoolId: 'initial-offering',
    parSpaceColor: 'pink',
    floatPercent: 50
})
