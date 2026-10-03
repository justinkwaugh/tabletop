import { moneyFormat, type CompanyColumn, type MarketZone, type TitleFact } from '@tabletop/18xx-ui'
import { companyLoans, getCompany, interestOwed, type EighteenXXState } from '@tabletop/18xx'
import {
    EighteenSeventeenLoanRules,
    MarketZoneColors,
    closingZone,
    corporationShareCount,
    seedMoneyLeft,
    stationsOwed
} from '@tabletop/1817'

const money = moneyFormat('$')

const started = (state: EighteenXXState, companyId: string) => {
    const company = getCompany(state, companyId)
    return company.kind !== 'private' && !!company.started
}

/** The opening's seed money while it lasts, and once the game's end is set, when it ends. */
export function eighteenSeventeenGameFacts(state: EighteenXXState): TitleFact[] {
    const facts: TitleFact[] = []
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

/** A company's loans against its limit, as "2/5". */
export function loansAgainstLimit(state: EighteenXXState, companyId: string): string {
    return `${companyLoans(state, companyId)}/${EighteenSeventeenLoanRules.capacity(state, companyId)}`
}

// A column with a value for started companies only, which sort before the others.
function startedColumn(
    id: string,
    label: string,
    value: (state: EighteenXXState, companyId: string) => number,
    text: (state: EighteenXXState, companyId: string) => string
): CompanyColumn {
    return {
        id,
        label,
        value: (state, companyId) =>
            started(state, companyId) ? value(state, companyId) : undefined,
        text: (state, companyId) => (started(state, companyId) ? text(state, companyId) : '—')
    }
}

export const EighteenSeventeenCompanyColumns: readonly CompanyColumn[] = [
    startedColumn('size', 'Size', corporationShareCount, (state, companyId) =>
        String(corporationShareCount(state, companyId))
    ),
    startedColumn('loans', 'Loans', companyLoans, loansAgainstLimit)
]

/** A started company's size, the interest it owes, stations it still owes, and its zone. */
export function eighteenSeventeenCompanyFacts(
    state: EighteenXXState,
    companyId: string
): TitleFact[] {
    if (!started(state, companyId)) return []
    const facts: TitleFact[] = [
        { label: 'Size', value: String(corporationShareCount(state, companyId)) }
    ]
    if (state.interestRate !== undefined) {
        const interest = interestOwed(state, EighteenSeventeenLoanRules, companyId)
        if (interest) facts.push({ label: 'Interest', value: money(interest) })
    }
    const owed = stationsOwed(state, companyId)
    if (owed) facts.push({ label: 'Stations owed', value: String(owed) })
    const zone = zoneFact(state, companyId)
    if (zone) facts.push(zone)
    return facts
}

/** The closing zone a company's price is in, when it is in one. */
export function zoneFact(state: EighteenXXState, companyId: string): TitleFact | undefined {
    const zone = closingZone(state.stockMarket, companyId)
    return zone
        ? { label: 'Zone', value: zone === 'acquisition' ? 'Acquisition' : 'Liquidation' }
        : undefined
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
