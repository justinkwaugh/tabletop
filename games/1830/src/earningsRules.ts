import { EighteenThirtyMarket } from './stockMarket.js'
import { payOrWithholdEarningsRules } from '@tabletop/18xx'

export const EighteenThirtyEarningsRules = payOrWithholdEarningsRules(EighteenThirtyMarket, {
    unpaidPoolIds: ['initial-offering'],
    companyPoolIds: ['open-market']
})
