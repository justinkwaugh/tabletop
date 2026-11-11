import { EighteenThirtyCharters } from './charters.js'
import { EighteenThirtyMarket } from './stockMarket.js'
import { payOrWithholdEarningsRules } from '@tabletop/18xx'

export const EighteenThirtyEarningsRules = payOrWithholdEarningsRules(
    EighteenThirtyMarket,
    EighteenThirtyCharters,
    {
        unpaidPoolIds: ['initial-offering'],
        companyPoolIds: ['open-market']
    }
)
