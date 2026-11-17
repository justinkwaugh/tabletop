import { EighteenSeventeenMarket } from './stockMarket.js'
import { assertExists } from '@tabletop/common'
import {
    controllingOwner,
    finiteCashOwnedBy,
    settleCashPayments,
    type CashPayment,
    type LoanRateTable,
    type LoanRules
} from '@tabletop/18xx'
import { corporationShareCount } from './corporations.js'
import { liquidate } from './liquidation.js'
import { LoanSharkId, companyHolding } from './privateHolders.js'

const LoanSharkInterest = 10
// 5% for each five loans taken in the game, rounded up, from 5% to 70%.
const RateTable: LoanRateTable = {
    loansPerRow: 5,
    rates: Array.from({ length: 14 }, (_, row) => 5 * (row + 1))
}

export const EighteenSeventeenLoanRules: LoanRules = {
    market: EighteenSeventeenMarket,
    value: 100,
    supply: RateTable.rates.length * RateTable.loansPerRow,
    capacity: (state, companyId) => corporationShareCount(state, companyId),
    rate: RateTable,
    // The Loan Shark's company pays $10 more each round for the rest of the game.
    extraInterest: (state, companyId) =>
        companyHolding(state, LoanSharkId) === companyId ? LoanSharkInterest : 0,
    takeMove: { direction: 'left', steps: 1 },
    repayMove: { direction: 'right', steps: 1 },
    // The company is liquidated and its cash goes to the president, who owes the interest.
    interestDefault(state, companyId, owed) {
        const president = controllingOwner(state, companyId)
        assertExists(president, 'A borrowing company has a president')
        const marketMove = liquidate(state, companyId)
        const company = { kind: 'company' as const, companyId }
        const treasury = finiteCashOwnedBy(state, company)
        const payments: CashPayment[] = []
        if (treasury) payments.push({ from: company, to: { ...president }, amount: treasury })
        settleCashPayments(state, payments)
        const paid = Math.min(owed, finiteCashOwnedBy(state, president))
        if (paid) {
            const payment = { from: { ...president }, to: { kind: 'bank' as const }, amount: paid }
            settleCashPayments(state, [payment])
            payments.push(payment)
        }
        return { payments, marketMoves: [marketMove], unpaid: owed - paid }
    }
}
