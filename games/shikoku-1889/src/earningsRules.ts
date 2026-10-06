import { payOrWithholdEarningsRules } from '@tabletop/18xx'

export const Shikoku1889EarningsRules = payOrWithholdEarningsRules({
    unpaidPoolIds: ['initial-offering'],
    companyPoolIds: ['open-market']
})
