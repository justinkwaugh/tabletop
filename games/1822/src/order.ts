import { floatedCompaniesInMarketOrder, getCompany, type StockState } from '@tabletop/18xx'
import { Market1822 } from './stockMarket.js'

/**
 * Minor companies run first, then major companies, each in descending share value: the further
 * right, then the higher in a stack, first among equals (§5.2).
 */
export function operatingOrder1822(state: Pick<StockState, 'companies' | 'stockMarket'>): string[] {
    const order = floatedCompaniesInMarketOrder(Market1822, state)
    const ofKind = (kind: string) => order.filter((id) => getCompany(state, id).kind === kind)
    return [...ofKind('minor'), ...ofKind('major')]
}
