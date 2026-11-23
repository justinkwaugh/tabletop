import {
    companyLoans,
    finiteCashOwnedBy,
    privateOwningCompany,
    trainsOwnedBy,
    type SizedCompanyState
} from '@tabletop/18xx'
import type { MoneyFormat } from '../presentation/money.js'
import { trainsFact } from '../trains/trainsFact.js'
import type { CardAction } from '../stock/CompanyActionCard.svelte'
import type { TitleFact } from '../session/titlePresentation.js'
import type {
    SizedCompanyMechanisms,
    SizedCompanySessionView
} from '../session/sizedCompanySession.svelte.js'

type FactRules = Pick<SizedCompanyMechanisms, 'market' | 'stations' | 'loanRules'>

/** A company's loans against its limit, as "2/5". */
export function loansAgainstLimit(
    rules: Pick<FactRules, 'loanRules'>,
    state: SizedCompanyState,
    companyId: string
): string {
    return `${companyLoans(state, companyId)}/${rules.loanRules.capacity(state, companyId)}`
}

/** The closing zone a company's price is in, when it is in one. */
export function zoneFact(
    rules: Pick<FactRules, 'market'>,
    state: SizedCompanyState,
    companyId: string
): TitleFact | undefined {
    const zone = rules.market.closingZone(state.stockMarket, companyId)
    return zone
        ? { label: 'Zone', value: zone === 'acquisition' ? 'Acquisition' : 'Liquidation' }
        : undefined
}

/** What a company can spend: its treasury and loans against its limit. */
export function companyFinanceFacts(
    rules: FactRules,
    state: SizedCompanyState,
    companyId: string,
    money: MoneyFormat
): TitleFact[] {
    return [
        {
            label: 'Treasury',
            value: money(finiteCashOwnedBy(state, { kind: 'company', companyId }))
        },
        { label: 'Loans', value: loansAgainstLimit(rules, state, companyId) }
    ]
}

/**
 * What a company owns besides cash: its trains, stations placed and held, and privates, last as
 * the widest, so a narrow card wraps them onto a row of their own.
 */
export function companyAssetFacts(
    rules: FactRules,
    state: SizedCompanyState,
    companyId: string,
    companyName: (companyId: string) => string
): TitleFact[] {
    const trains = trainsOwnedBy(state, { kind: 'company', companyId })
    const privates = state.companies.filter(
        (company) =>
            company.kind === 'private' && privateOwningCompany(state, company.id) === companyId
    )
    const placed = state.stations.filter(
        (station) => station.companyId === companyId && station.status === 'placed'
    ).length
    const counted = rules.stations
        .heldLimitMarkers(state, companyId)
        .map((marker) => ` + ${marker.privateCompanyId}`)
        .join('')
    return [
        trainsFact(trains),
        {
            label: 'Stations',
            value: `${placed}/${rules.stations.heldStations(state, companyId)}${counted}`
        },
        ...(privates.length
            ? [
                  {
                      label: 'Privates',
                      value: privates.map((company) => companyName(company.id)).join(', '),
                      privateIds: privates.map((company) => company.id)
                  }
              ]
            : [])
    ]
}

/** What a round's decision turns on: a company's size, closing zone, finances and assets. */
export function companyRoundFacts(
    rules: FactRules,
    state: SizedCompanyState,
    companyId: string,
    money: MoneyFormat,
    companyName: (companyId: string) => string
): TitleFact[] {
    const zone = zoneFact(rules, state, companyId)
    return [
        { label: 'Size', value: String(rules.market.shareCount(state, companyId)) },
        ...(zone ? [zone] : []),
        ...companyFinanceFacts(rules, state, companyId, money),
        ...companyAssetFacts(rules, state, companyId, companyName)
    ]
}

/** Borrowing for a company, as each round's card offers it. */
export function takeLoanAction(
    session: SizedCompanySessionView,
    companyId: string,
    ariaLabel: string,
    disabled: boolean
): CardAction {
    return {
        label: 'Take a loan',
        detail: `+${session.presentation.money(session.sizedCompanies.loanRules.value)}`,
        ariaLabel,
        disabled,
        onclick: () => session.loans.take(companyId)
    }
}
