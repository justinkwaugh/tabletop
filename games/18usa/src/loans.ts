export const LoanValue = 100
export const LoanSupply = 70
/** Taking a loan moves the share price two spaces left; repaying one, two right (§9). */
export const LoanMarketSteps = 2

/** A row of the Bank of New York: its interest rate in percent and the loans it holds. */
export type LoanTier = { rate: number; loans: number }

const rows = (count: number, loansAt: (rate: number) => number): LoanTier[] =>
    Array.from({ length: count }, (_, index) => {
        const rate = 5 * (index + 1)
        return { rate, loans: loansAt(rate) }
    })

// With five or more players the mat's other side lends four loans at 5% and six on each
// other row, up to 60% (§2.2).
export function loanTiers(playerCount: number): readonly LoanTier[] {
    return playerCount >= 5 ? rows(12, (rate) => (rate === 5 ? 4 : 6)) : rows(14, () => 5)
}

/** The rate of the topmost row loans have been taken from; the first row's before any are. */
export function loanInterestRate(tiers: readonly LoanTier[], outstanding: number): number {
    let lent = 0
    for (const tier of tiers) {
        lent += tier.loans
        if (outstanding <= lent) return tier.rate
    }
    return tiers[tiers.length - 1].rate
}
