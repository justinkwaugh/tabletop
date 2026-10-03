import { privateOwningCompany, type FinancialState } from '@tabletop/18xx'

/** The company holding a private, when the game has the private at all; Volatility's may not. */
export function companyHolding(state: FinancialState, privateId: string): string | undefined {
    return state.companies.some((company) => company.id === privateId)
        ? privateOwningCompany(state, privateId)
        : undefined
}
