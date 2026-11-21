import {
    BankruptcyPrice,
    ChoiceAuctionState,
    GameEndPrice,
    IpoPoolId,
    LayerParRanges,
    Map1860,
    MarketPoolId,
    MarketZoneColors1860,
    TitleRules1860,
    canStart,
    company1860,
    isLayHomeTile,
    openLayer,
    startPrices,
    type State1860
} from '@tabletop/1860'
import { getCompany, inReceivership } from '@tabletop/18xx'
import {
    moneyFormat,
    printedHomeCompanies,
    type CompanyMark,
    type TitleFact,
    type TitlePresentation
} from '@tabletop/18xx-ui'
import { CompanyNames1860 } from './companyPresentation.js'
import { endgameNotice } from './endgamePresentation.js'
import { PhaseChart1860 } from './phaseChart.js'
import { PhaseColors1860, TrainColors1860 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1860.currencySymbol)
const printedHomes = printedHomeCompanies<State1860>(Map1860)

const range = (prices: readonly number[]) =>
    prices.length > 1 ? `${money(prices[0])}–${money(prices.at(-1) ?? 0)}` : money(prices[0])

/** The state a company is in that changes how it runs (Insolvency; Receivership; Bankrupt Companies; Nationalisation). */
function companyMarks(state: State1860, companyId: string): CompanyMark[] {
    if (state.bankruptIds.includes(companyId))
        return [
            {
                label: 'Bankrupt',
                description:
                    'Its price fell to nothing: its shares went back to the IPO and its bases lie face down, blocking no run. Whoever buys its director’s share starts it again, with the treasury, trains and bases it kept.'
            }
        ]
    if (state.nationalisation?.closedCompanyIds.includes(companyId))
        return [
            {
                label: 'Nationalised',
                description:
                    'Closed by British Rail after paying the least in an operating round: it no longer operates, and its price stands for the rest of the game.'
            }
        ]
    const company = getCompany(state, companyId)
    if (!company.started || company.closed) return []
    return [
        ...(state.insolventIds.includes(companyId)
            ? [
                  {
                      label: 'Insolvent',
                      description:
                          'It ended a turn without a train though it had a route: it keeps its revenue, places no bases, lays no paid track or upgrades, and leases the bank’s smallest train while it cannot buy one.'
                  }
              ]
            : []),
        ...(inReceivership(state, companyId)
            ? [
                  {
                      label: 'Receivership',
                      description:
                          'Its director’s share is in the Bank Pool: its largest holder runs it for the most it can earn. It keeps its revenue, lays no track, places no bases, and buys a train only when it has none. The first player to hold two shares takes the director’s share.'
                  }
              ]
            : [])
    ]
}

/** An unstarted company's layer and the prices it may start at (Major Companies; Bankrupt Companies). */
function companyFacts(state: State1860, companyId: string): TitleFact[] {
    if (getCompany(state, companyId).started) return []
    const prices = startPrices(state, companyId)
    const { layer } = company1860(companyId)
    return [
        { label: 'Layer', value: `${layer}${layer > openLayer(state) ? ' (closed)' : ''}` },
        {
            label: state.bankruptIds.includes(companyId) ? 'Refloat' : 'Par',
            value: range(prices)
        }
    ]
}

function bareHome(state: State1860, companyId: string): boolean {
    const home = company1860(companyId).home
    return (
        !state.tileInventory.placements[home] &&
        Map1860.location(home).preprintedTile.color === 'white'
    )
}

export const Presentation1860: TitlePresentation<State1860> = {
    money,
    phaseChart: PhaseChart1860,
    trainColors: TrainColors1860,
    phaseColors: PhaseColors1860,
    marketPoolId: MarketPoolId,
    ipoPoolId: IpoPoolId,
    companyNames: CompanyNames1860,
    terms: {
        president: 'Director',
        presidency: 'Directorship',
        marketPool: 'Bank Pool',
        stationTokensHeading: 'Bases',
        stationToken: 'base'
    },
    openingRound: {
        name: 'Initial auction',
        abbreviation: 'Auction',
        inProgress: (state) => state.machineState === ChoiceAuctionState
    },
    unstartedCompanies: {
        onOffer: (state, companyId) => canStart(state, companyId),
        home: printedHomes.home
    },
    companyMarks,
    companyFacts,
    startNotes: (state, companyId) =>
        bareHome(state, companyId)
            ? ['Its director lays a tile on its home hex as it floats.']
            : [],
    gameFacts: (state) => [
        { label: 'Layers open', value: openLayer(state) === 1 ? '1' : `1–${openLayer(state)}` }
    ],
    phaseNotice: endgameNotice,
    runSubsidyName: 'halt subsidy',
    // Before British Rail forms a director need not run for the most; a receiver must (Running
    // Trains; Companies In Receivership; Railway Nationalisation).
    manualRoutes: (state, companyId) => !state.nationalisation && !inReceivership(state, companyId),
    historyMapPlacement: (action) =>
        isLayHomeTile(action)
            ? { kind: 'home tile', companyId: action.companyId, locationIds: [action.locationId] }
            : undefined,
    // Fifty-five narrow spaces zig-zagging between two tiers, each half a space on from the last.
    marketCell: { width: 32, height: 72, step: 16 },
    // Share Price Movement; Bankrupt Companies; The End of the Game.
    marketZones: [
        {
            color: MarketZoneColors1860.par,
            name: 'Par',
            description: `A price a company may start at: ${Object.entries(LayerParRanges)
                .map(
                    ([layer, { minimum, maximum }]) =>
                        `layer ${layer} ${money(minimum)}–${money(maximum)}`
                )
                .join(', ')}.`
        },
        {
            color: MarketZoneColors1860.refloat,
            name: 'Refloat',
            description:
                'With the par prices, where a bankrupt company may be started again: from £40 up to its layer’s highest par.',
            fill: { kind: 'solid', color: '#c4c7c9' }
        },
        {
            color: MarketZoneColors1860.ignoreFirstSale,
            name: 'Red letters',
            description:
                'Below £40 and above £150 the first share of a sale leaves the price where it is.',
            marksCompanyValue: true
        },
        {
            color: MarketZoneColors1860.bankruptcy,
            name: 'Bankruptcy',
            description: `A company whose price falls to ${money(BankruptcyPrice)} goes bankrupt.`
        },
        {
            color: MarketZoneColors1860.gameEnd,
            name: 'Game end',
            description: `A company reaching ${money(GameEndPrice)} ends the game after the operating round.`
        }
    ]
}
