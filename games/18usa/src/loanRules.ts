import type { LoanRateTable, LoanRules, LoanState } from '@tabletop/18xx'
import { companyLoans, loanRate } from '@tabletop/18xx'
import { EighteenUSAMarket } from './stockMarket.js'
import { EighteenUSACompanyMarket } from './marketZones.js'
import { LoanMarketSteps, LoanSupply, LoanValue, loanTiers } from './loans.js'
import { companyHolding, WesternLandGrantId } from './privateHolders.js'

const WesternLandGrantInterest = 5

function rateTable(state: LoanState): LoanRateTable {
    const tiers = loanTiers(state.players.length)
    return { loansPerRow: tiers.map((tier) => tier.loans), rates: tiers.map((tier) => tier.rate) }
}

/**
 * Loans of $100 from the Bank of New York, whose side and rows depend on the player count (§2.2);
 * each moves the price two spaces (§9). A company repays none in a turn it borrowed (§12.9). The
 * Western Land Grant's company may take one loan more, at a fixed $5 (P15).
 */
export const EighteenUSALoanRules: LoanRules = {
    market: EighteenUSAMarket,
    value: LoanValue,
    supply: LoanSupply,
    capacity: (state, companyId) =>
        EighteenUSACompanyMarket.shareCount(state, companyId) +
        (companyHolding(state, WesternLandGrantId) === companyId ? 1 : 0),
    rate: { tableFor: rateTable },
    // The grant's loan is repaid last, so it is outstanding while any loan is, at $5 instead of
    // the rate.
    extraInterest(state, companyId) {
        if (companyHolding(state, WesternLandGrantId) !== companyId) return 0
        if (!companyLoans(state, companyId)) return 0
        const rate = state.interestRate ?? loanRate(state, EighteenUSALoanRules)
        return WesternLandGrantInterest - (rate * LoanValue) / 100
    },
    takeMove: { direction: 'left', steps: LoanMarketSteps },
    repayMove: { direction: 'right', steps: LoanMarketSteps },
    noRepaymentAfterBorrowing: true,
    interestDefault: (state, companyId, owed) =>
        EighteenUSACompanyMarket.liquidationInterestDefault(state, companyId, owed)
}
