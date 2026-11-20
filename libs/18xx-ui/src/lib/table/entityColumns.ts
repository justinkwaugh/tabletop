import {
    controllingOwner,
    playersWithBankruptLast,
    type Company,
    type StockState
} from '@tabletop/18xx'

export interface EntityHolders {
    playerIds: readonly string[]
    portfolioCompanyIds: readonly string[]
}

export type EntityColumn = EntityHolders & {
    key: string
    companies: readonly Company[]
}

export function entityColumns(
    state: StockState,
    companies: readonly Company[],
    portfolioCompanyIds: readonly string[]
): EntityColumn[] {
    const controller = (companyId: string) => controllingOwner(state, companyId)?.playerId
    const companiesByPlayer = Map.groupBy(companies, (company) => controller(company.id))
    const portfoliosByPlayer = Map.groupBy(portfolioCompanyIds, controller)
    const playerColumns = playersWithBankruptLast(state).map((playerId) => ({
        key: playerId,
        playerIds: [playerId],
        portfolioCompanyIds: portfoliosByPlayer.get(playerId) ?? [],
        companies: companiesByPlayer.get(playerId) ?? []
    }))
    const uncontrolled = {
        key: 'uncontrolled',
        playerIds: [],
        portfolioCompanyIds: portfoliosByPlayer.get(undefined) ?? [],
        companies: companiesByPlayer.get(undefined) ?? []
    }
    return uncontrolled.portfolioCompanyIds.length || uncontrolled.companies.length
        ? [...playerColumns, uncontrolled]
        : playerColumns
}
