import { Shikoku1889Charters } from './charters.js'
import { Shikoku1889Market } from './stockMarket.js'
import { payOrWithholdEarningsRules } from '@tabletop/18xx'

export const Shikoku1889EarningsRules = payOrWithholdEarningsRules(
    Shikoku1889Market,
    Shikoku1889Charters,
    {
        unpaidPoolIds: ['initial-offering'],
        companyPoolIds: ['open-market']
    }
)
