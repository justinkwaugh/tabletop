import {
    finiteCashOwnedBy,
    privateOwningCompany,
    trainsOwnedBy,
    type EighteenXXState
} from '@tabletop/18xx'
import { corporationShareCount, heldStations } from '@tabletop/1817'
import type { MoneyFormat, TitleFact } from '@tabletop/18xx-ui'
import { loansAgainstLimit, zoneFact } from './titleFacts.js'

/** What a company can spend: its treasury and loans against its limit. */
export function companyFinanceFacts(
    state: EighteenXXState,
    companyId: string,
    money: MoneyFormat
): TitleFact[] {
    return [
        {
            label: 'Treasury',
            value: money(finiteCashOwnedBy(state, { kind: 'company', companyId }))
        },
        { label: 'Loans', value: loansAgainstLimit(state, companyId) }
    ]
}

/** What a company owns besides cash: its trains, privates and stations placed and held. */
export function companyAssetFacts(state: EighteenXXState, companyId: string): TitleFact[] {
    const counts = new Map<string, number>()
    for (const train of trainsOwnedBy(state, { kind: 'company', companyId }))
        counts.set(train.definitionId, (counts.get(train.definitionId) ?? 0) + 1)
    const trains = [...counts].map(([type, count]) => (count > 1 ? `${type} ×${count}` : type))
    const privates = state.companies.filter(
        (company) =>
            company.kind === 'private' && privateOwningCompany(state, company.id) === companyId
    )
    const placed = state.stations.filter(
        (station) => station.companyId === companyId && station.status === 'placed'
    ).length
    return [
        { label: 'Trains', value: trains.length ? trains.join(', ') : '—' },
        ...(privates.length
            ? [{ label: 'Privates', value: privates.map((company) => company.name).join(', ') }]
            : []),
        { label: 'Stations', value: `${placed}/${heldStations(state, companyId)}` }
    ]
}

/** What a round's decision turns on: a company's size, finances, assets and closing zone. */
export function companyRoundFacts(
    state: EighteenXXState,
    companyId: string,
    money: MoneyFormat
): TitleFact[] {
    const zone = zoneFact(state, companyId)
    return [
        { label: 'Size', value: String(corporationShareCount(state, companyId)) },
        ...companyFinanceFacts(state, companyId, money),
        ...companyAssetFacts(state, companyId),
        ...(zone ? [zone] : [])
    ]
}
