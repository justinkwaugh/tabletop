import {
    companyLoans,
    finiteCashOwnedBy,
    getCompany,
    trainsOwnedBy,
    type EighteenXXState
} from '@tabletop/18xx'
import { EighteenSeventeenLoanRules } from '@tabletop/1817'
import type { MoneyFormat } from '@tabletop/18xx-ui'
import type { CardFact } from './CompanyActionCard.svelte'

/** What a round's decision turns on: a company's size, treasury, loans, trains and stations. */
export function companyRoundFacts(
    state: EighteenXXState,
    companyId: string,
    money: MoneyFormat
): CardFact[] {
    const company = { kind: 'company' as const, companyId }
    const stations = state.stations.filter(
        (station) => station.companyId === companyId && station.status !== 'removed'
    )
    const counts = new Map<string, number>()
    for (const train of trainsOwnedBy(state, company))
        counts.set(train.definitionId, (counts.get(train.definitionId) ?? 0) + 1)
    const trains = [...counts].map(([type, count]) => (count > 1 ? `${type} ×${count}` : type))
    return [
        { label: 'Size', value: String(getCompany(state, companyId).shareCount) },
        { label: 'Treasury', value: money(finiteCashOwnedBy(state, company)) },
        {
            label: 'Loans',
            value: `${companyLoans(state, companyId)}/${EighteenSeventeenLoanRules.capacity(state, companyId)}`
        },
        { label: 'Trains', value: trains.length ? trains.join(', ') : '—' },
        {
            label: 'Stations',
            value: `${stations.filter((station) => station.status === 'placed').length}/${stations.length}`
        }
    ]
}
