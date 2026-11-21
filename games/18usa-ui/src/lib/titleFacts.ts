import type { EighteenUSAState } from '@tabletop/18usa'
import {
    moneyFormat,
    zoneFact,
    type CompanyColumn,
    type MarketZone,
    type TitleFact
} from '@tabletop/18xx-ui'
import { getCompany, interestOwed } from '@tabletop/18xx'
import {
    EighteenUSACompanyMarket,
    EighteenUSALoanRules,
    EighteenUSAStations,
    EighteenUSATitleRules,
    MarketZoneColors,
    citySubsidy
} from '@tabletop/18usa'

const money = moneyFormat(EighteenUSATitleRules.currencySymbol)

const started = (state: EighteenUSAState, companyId: string) => {
    const company = getCompany(state, companyId)
    return company.kind !== 'private' && !!company.started
}

const shareCount = (state: EighteenUSAState, companyId: string) =>
    EighteenUSACompanyMarket.shareCount(state, companyId)

/** When the game ends, once the first 8-train has set it: after that round’s acquisitions (§16). */
export function eighteenUSAGameFacts(state: EighteenUSAState): TitleFact[] {
    const ending = state.gameEnding
    if (!ending?.finalOperatingSet || !ending.finalOperatingRounds || state.result !== undefined)
        return []
    return [
        {
            label: 'Game ends',
            value: `after AR ${ending.finalOperatingSet}.${ending.finalOperatingRounds}`
        }
    ]
}

export const EighteenUSACompanyColumns: readonly CompanyColumn<EighteenUSAState>[] = [
    {
        id: 'size',
        label: 'Size',
        value: (state, companyId) =>
            started(state, companyId) ? shareCount(state, companyId) : undefined,
        text: (state, companyId) =>
            started(state, companyId) ? String(shareCount(state, companyId)) : '—'
    }
]

/** A started company's size, the interest it owes, stations it still owes, and its zone. */
export function eighteenUSACompanyFacts(state: EighteenUSAState, companyId: string): TitleFact[] {
    if (!started(state, companyId)) return []
    const facts: TitleFact[] = [{ label: 'Size', value: String(shareCount(state, companyId)) }]
    if (state.interestRate !== undefined) {
        const interest = interestOwed(state, EighteenUSALoanRules, companyId)
        if (interest) facts.push({ label: 'Interest', value: money(interest) })
    }
    const owed = EighteenUSAStations.stationsOwed(state, companyId)
    if (owed) facts.push({ label: 'Stations owed', value: String(owed) })
    const zone = zoneFact({ market: EighteenUSACompanyMarket }, state, companyId)
    if (zone) facts.push(zone)
    return facts
}

export const EighteenUSAMarketZones: readonly MarketZone[] = [
    {
        color: MarketZoneColors.liquidation,
        name: 'Liquidation',
        description:
            'The company does not operate, and the bank sells it in the acquisition round.',
        marksCompanyValue: true,
        fill: { kind: 'solid', color: '#c4433a', ink: '#fff8f0' },
        label: 'Liquidation'
    },
    {
        color: MarketZoneColors.acquisition,
        name: 'Acquisition',
        description:
            'The company is auctioned from $10 in the acquisition round, and may not buy another.',
        marksCompanyValue: true,
        fill: { kind: 'solid', color: '#a9aeb2' },
        banner: { label: 'Acquisition', shape: 'span' }
    },
    {
        color: MarketZoneColors.par,
        name: 'Start price',
        description: 'A price a company may start at: half its winning bid, from $50 to $200.',
        banner: { label: 'Start prices', shape: 'span' }
    },
    {
        color: MarketZoneColors.safe,
        name: 'Safe start',
        description:
            'The lowest start for a 2-, 5- or 10-share company ($53, $74, $120) that borrows its full limit without reaching acquisition.'
    }
]

/** The subsidy a home city still offers the company started there (§11.6.1). */
export function eighteenUSAHomeNotes(state: EighteenUSAState, locationId: string): string[] {
    const offered = citySubsidy(state, locationId)
    if (!offered) return []
    return offered.effect.kind === 'none'
        ? [offered.description]
        : [`${offered.name} subsidy: ${offered.description}`]
}
