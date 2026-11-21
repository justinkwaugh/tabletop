import { EighteenSeventeenMarket } from './stockMarket.js'
import type { LoanRateTable, LoanRules } from '@tabletop/18xx'
import { corporationShareCount } from './corporations.js'
import { EighteenSeventeenCompanyMarket } from './marketZones.js'
import { LoanSharkId, companyHolding } from './privateHolders.js'

const LoanSharkInterest = 10
// 5% for each five loans taken in the game, rounded up, from 5% to 70%.
const LoansPerRow = 5
const RateTable: LoanRateTable = {
    loansPerRow: LoansPerRow,
    rates: Array.from({ length: 14 }, (_, row) => 5 * (row + 1))
}

export const EighteenSeventeenLoanRules: LoanRules = {
    market: EighteenSeventeenMarket,
    value: 100,
    supply: RateTable.rates.length * LoansPerRow,
    capacity: (state, companyId) => corporationShareCount(state, companyId),
    rate: RateTable,
    // The Loan Shark's company pays $10 more each round for the rest of the game.
    extraInterest: (state, companyId) =>
        companyHolding(state, LoanSharkId) === companyId ? LoanSharkInterest : 0,
    takeMove: { direction: 'left', steps: 1 },
    repayMove: { direction: 'right', steps: 1 },
    // The company is liquidated and its cash goes to the president, who owes the interest.
    interestDefault: (state, companyId, owed) =>
        EighteenSeventeenCompanyMarket.liquidationInterestDefault(state, companyId, owed)
}
