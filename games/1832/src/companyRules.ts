import {
    fullCapitalizationCompanyRules,
    sharesStillToFloat,
    type CompanyRules
} from '@tabletop/18xx'
import { recordCompanyStart } from './londonInvestment.js'

const IpoPoolId = 'initial-offering'
const FloatPercent = 60

export const EighteenThirtyTwoCompanyRules: CompanyRules = {
    ...fullCapitalizationCompanyRules({
        ipoPoolId: IpoPoolId,
        parSpaceColor: 'pink',
        floatPercent: FloatPercent
    }),
    // A company floats when its sixth share leaves the initial offering, but receives its capital
    // only as the stock round ends (§5.6.4).
    flotationPayments: (state, companyId) =>
        sharesStillToFloat(
            state,
            companyId,
            FloatPercent,
            (certificate) => certificate.poolId === IpoPoolId
        ) === 0
            ? []
            : undefined,
    onStart: recordCompanyStart,
    parAfterAward: true
}
