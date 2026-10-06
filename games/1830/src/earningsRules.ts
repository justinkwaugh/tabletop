import { payOrWithholdEarningsRules } from '@tabletop/18xx'

export const EighteenThirtyEarningsRules = payOrWithholdEarningsRules({
    unpaidPoolIds: ['initial-offering'],
    companyPoolIds: ['open-market']
})
