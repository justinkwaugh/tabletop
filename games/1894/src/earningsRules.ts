import { EighteenNinetyFourCharters } from './charters.js'
import { EighteenNinetyFourMarket } from './stockMarket.js'
import { payOrWithholdEarningsRules } from '@tabletop/18xx'

// IPO shares pay the company and bank pool shares pay nobody; shares in the company's own
// treasury pay it as their holder (§7.3.6).
export const EighteenNinetyFourEarningsRules = payOrWithholdEarningsRules(
    EighteenNinetyFourMarket,
    EighteenNinetyFourCharters,
    {
        unpaidPoolIds: ['open-market'],
        companyPoolIds: ['initial-offering']
    }
)
