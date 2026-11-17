import { assert } from '@tabletop/common'
import { automaticBorrowing, getCompany, type LoanRules } from '@tabletop/18xx'
import { LoanLimits1861, LoanValue1861, RsrId } from './companies.js'
import { Market1861 } from './stockMarket.js'

/** Loan interest is R5 on each R50 loan (§10.2). */
const InterestRate = 10

/**
 * Loans of R50, at most two for a minor and five for a public company, and as many as the
 * RSR needs. They are taken only to pay for track, a trainless company's train from the bank,
 * or interest, and only as many as the payment needs; the first R5 of interest is paid at once
 * (§10.2).
 */
export const LoanRules1861: LoanRules = {
    market: Market1861,
    value: LoanValue1861,
    // The bank has loans for all; the RSR may borrow without limit (§10.2).
    supply: Number.POSITIVE_INFINITY,
    capacity(state, companyId) {
        if (companyId === RsrId) return Number.POSITIVE_INFINITY
        const company = getCompany(state, companyId)
        return company.kind === 'minor' ? LoanLimits1861.minor : LoanLimits1861.major
    },
    rate: () => InterestRate,
    interestDefault() {
        assert(false, 'An 1861 company that cannot pay interest is nationalised')
    },
    automatic: true,
    interestWhenTaken: true
}

export const Borrowing1861 = automaticBorrowing(LoanRules1861)
