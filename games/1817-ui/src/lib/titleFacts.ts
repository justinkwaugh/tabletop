import type { CompanyColumn, CompanyFact, GameFact, MarketZone } from '@tabletop/18xx-ui'
import { companyLoans, getCompany, interestOwed, type EighteenXXState } from '@tabletop/18xx'
import {
    EighteenSeventeenLoanRules,
    MarketZoneColors,
    closingZone,
    seedMoneyLeft,
    stationsOwed
} from '@tabletop/1817'

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`

const started = (state: EighteenXXState, companyId: string) => {
    const company = getCompany(state, companyId)
    return company.kind !== 'private' && !!company.started
}

/** The opening's seed money while it lasts, and once the game's end is set, when it ends. */
export function eighteenSeventeenGameFacts(state: EighteenXXState): GameFact[] {
    const facts: GameFact[] = []
    const seedMoney = seedMoneyLeft(state)
    if (state.selectionAuction && !state.selectionAuction.completed && seedMoney !== undefined)
        facts.push({ label: 'Seed money', value: money(seedMoney) })
    const ending = state.gameEnding
    if (
        ending?.finalOperatingSet &&
        ending.finalOperatingRounds &&
        state.machineState !== 'GameOver'
    )
        facts.push({
            label: 'Game ends',
            value: `after AR ${ending.finalOperatingSet}.${ending.finalOperatingRounds}`
        })
    return facts
}

export const EighteenSeventeenCompanyColumns: readonly CompanyColumn[] = [
    {
        id: 'size',
        label: 'Size',
        value: (state, companyId) =>
            started(state, companyId) ? getCompany(state, companyId).shareCount : undefined,
        text: (state, companyId) =>
            started(state, companyId) ? String(getCompany(state, companyId).shareCount) : '—'
    },
    {
        id: 'loans',
        label: 'Loans',
        value: (state, companyId) =>
            started(state, companyId) ? companyLoans(state, companyId) : undefined,
        text: (state, companyId) =>
            started(state, companyId)
                ? `${companyLoans(state, companyId)}/${EighteenSeventeenLoanRules.capacity(state, companyId)}`
                : '—'
    }
]

/** A started company's size, the interest it owes, stations it still owes, and its zone. */
export function eighteenSeventeenCompanyFacts(
    state: EighteenXXState,
    companyId: string
): CompanyFact[] {
    if (!started(state, companyId)) return []
    const facts: CompanyFact[] = [
        { label: 'Size', value: String(getCompany(state, companyId).shareCount) }
    ]
    if (state.interestRate !== undefined) {
        const interest = interestOwed(state, EighteenSeventeenLoanRules, companyId)
        if (interest) facts.push({ label: 'Interest', value: money(interest) })
    }
    const owed = stationsOwed(state, companyId)
    if (owed) facts.push({ label: 'Stations owed', value: String(owed) })
    const zone = closingZone(state.stockMarket, companyId)
    if (zone)
        facts.push({ label: 'Zone', value: zone === 'acquisition' ? 'Acquisition' : 'Liquidation' })
    return facts
}

export const EighteenSeventeenMarketZones: readonly MarketZone[] = [
    {
        color: MarketZoneColors.liquidation,
        name: 'Liquidation',
        description: 'The company does not operate, and the bank sells it in the acquisition round.'
    },
    {
        color: MarketZoneColors.acquisition,
        name: 'Acquisition',
        description:
            'The company is auctioned from $10 in the acquisition round, and may not buy another.'
    },
    {
        color: MarketZoneColors.par,
        name: 'Par',
        description: 'A price a company may start at.'
    },
    {
        color: MarketZoneColors.safe,
        name: 'Safe par',
        description:
            'The lowest start for a 2-, 5- or 10-share company ($55, $70, $120) that borrows its full limit without reaching acquisition.'
    }
]
