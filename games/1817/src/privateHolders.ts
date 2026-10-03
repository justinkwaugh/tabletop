import { privateOwningCompany, type FinancialState } from '@tabletop/18xx'

// The Volatility privates whose powers the rules look up.
export const LoanSharkId = 'P12'
/** What the Loan Shark brings the company it is contributed to. */
export const LoanSharkCash = 60
export const PonziSchemeId = 'P13'
export const InventorId = 'P14'
export const ScrapperId = 'P15'
export const ExpressTrackId = 'P18'
export const EfficientTrackId = 'P19'
export const GoldenParachuteId = 'P20'
export const StationSubsidyId = 'P21'

/** Whether the game has the private and it is still open; Volatility's may never be dealt. */
export function privateOpen(state: FinancialState, privateId: string): boolean {
    return state.companies.some((company) => company.id === privateId && !company.closed)
}

/** The company holding a private, when the game has the private at all. */
export function companyHolding(state: FinancialState, privateId: string): string | undefined {
    return state.companies.some((company) => company.id === privateId)
        ? privateOwningCompany(state, privateId)
        : undefined
}
