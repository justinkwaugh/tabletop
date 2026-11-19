import { getCompany, privateOwner, type FinancialState, type Owner } from '@tabletop/18xx'

/** Who holds an open private of the game, if it is in the game and open. */
export function openPrivateOwner(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    privateCompanyId: string
): Owner | undefined {
    const company = state.companies.find((entry) => entry.id === privateCompanyId)
    if (!company || company.closed) return undefined
    return privateOwner(state, privateCompanyId)
}

/** Whether a railroad owns the open private. */
export function ownsOpenPrivate(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    companyId: string,
    privateCompanyId: string
): boolean {
    const owner = openPrivateOwner(state, privateCompanyId)
    return owner?.kind === 'company' && owner.companyId === companyId
}

/** The railroad that owns the open private, if a railroad does. */
export function privateCompanyHolder(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    privateCompanyId: string
): string | undefined {
    const owner = openPrivateOwner(state, privateCompanyId)
    return owner?.kind === 'company' && !getCompany(state, owner.companyId).closed
        ? owner.companyId
        : undefined
}

/** The player who owns the open private, if a player does. */
export function privatePlayerHolder(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    privateCompanyId: string
): string | undefined {
    const owner = openPrivateOwner(state, privateCompanyId)
    return owner?.kind === 'player' ? owner.playerId : undefined
}
