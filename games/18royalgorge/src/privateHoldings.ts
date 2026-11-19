import { getCompany, privateOwner, type FinancialState, type Owner } from '@tabletop/18xx'
import { CoalCreekId, CoalDepotId, JewelerId, SteelDepotId } from './ids.js'
import type { HydratedStateRoyalGorge } from './state.js'

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

/** Whether the private is in the game and still open. */
function privateOpen(state: Pick<FinancialState, 'companies'>, privateCompanyId: string): boolean {
    const company = state.companies.find((entry) => entry.id === privateCompanyId)
    return !!company && !company.closed
}

/**
 * Empties the cards of closed privates: the Jeweler's money is lost (Y6), and the steel and coal
 * left on the Steel Depot, Coal Creek and the Coal Depot leave the game with them.
 */
export function emptyClosedPrivates(state: HydratedStateRoyalGorge): void {
    if (!privateOpen(state, JewelerId)) state.jewelerCash = 0
    if (!privateOpen(state, SteelDepotId)) state.depotSteel = 0
    if (!privateOpen(state, CoalCreekId)) {
        state.coalCreekCubes = 0
        state.coalCreekSupply = 0
    }
    if (!privateOpen(state, CoalDepotId)) state.coalDepotCubes = 0
}
