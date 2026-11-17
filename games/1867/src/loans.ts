import { assert } from '@tabletop/common'
import { automaticBorrowing, getCompany, type LoanRules } from '@tabletop/18xx'
import { LoanLimits1867, LoanValue1867 } from './companies.js'
import { Market1867 } from './stockMarket.js'

/** Loan interest is $5 on each $50 loan (GTG §8.2). */
const InterestRate = 10

/**
 * Loans of $50, at most two for a minor and five for a major. They are taken only to pay for
 * track, a trainless company's train from the bank, or interest, and only as many as the payment
 * needs; the first $5 of interest is paid at once (GTG §8.2). The CN never borrows (§8.13).
 */
export const LoanRules1867: LoanRules = {
    market: Market1867,
    value: LoanValue1867,
    supply: Number.POSITIVE_INFINITY,
    capacity(state, companyId) {
        const company = getCompany(state, companyId)
        if (company.kind === 'minor') return LoanLimits1867.minor
        if (company.kind === 'major') return LoanLimits1867.major
        return 0
    },
    rate: () => InterestRate,
    interestDefault() {
        assert(false, 'An 1867 company that cannot pay interest is nationalised')
    },
    automatic: true,
    interestWhenTaken: true
}

export const Borrowing1867 = automaticBorrowing(LoanRules1867)
