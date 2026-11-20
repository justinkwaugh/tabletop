import {
    CaId,
    CobourgCompanyRevenue,
    CobourgRailwayId,
    CompanyRules1828,
    CpId,
    CslId,
    DhId,
    DirectorPrivates1828,
    EkId,
    IpoPoolId1828,
    Map1828,
    MarketPoolId1828,
    TitleRules1828,
    PrrId,
    TrainDepot1828,
    coalHolders,
    cobourgTreasury,
    constituents,
    isSystem,
    requireState1828,
    trainShells,
    type State1828
} from '@tabletop/1828'
import { getCompany, privateOwner } from '@tabletop/18xx'
import {
    DefaultCompanyPricePresentation,
    moneyFormat,
    printedHomeCompanies,
    type PrivateTokenPresentation,
    type TitleFact,
    type TitlePresentation
} from '@tabletop/18xx-ui'
import { CompanyNames1828 } from './companyPresentation.js'
import { describe1828MapPlacement } from './history.js'
import { PhaseChart1828 } from './phaseChart.js'
import { PhaseColors1828, TrainColors1828 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1828.currencySymbol)
const PrintedHomes1828 = printedHomeCompanies<State1828>(Map1828)

/** A system's two shells, each with its trains (§13.4). */
function shellFacts(state: State1828, companyId: string): TitleFact[] {
    if (!isSystem(state, companyId)) return []
    const shellCompanyIds = constituents(state, companyId)
    return trainShells(requireState1828(state), companyId).map((trains, index) => ({
        label: `${CompanyNames1828[shellCompanyIds[index]].initials} shell`,
        value: trains.length
            ? trains
                  .map((train) => TrainDepot1828.trainDefinition(train.definitionId).name)
                  .join(', ')
            : 'no trains',
        below: true
    }))
}

export const Presentation1828: TitlePresentation<State1828> = {
    // No company starts in purple phase (§17.7).
    unstartedCompanies: {
        ...PrintedHomes1828,
        onOffer: (state, companyId) =>
            CompanyRules1828.startMarketSpaces(state, companyId).length > 0
    },
    money,
    phaseChart: PhaseChart1828,
    trainColors: TrainColors1828,
    phaseColors: PhaseColors1828,
    marketPoolId: MarketPoolId1828,
    ipoPoolId: IpoPoolId1828,
    companyNames: CompanyNames1828,
    terms: {
        president: 'Director',
        presidency: 'Directorship',
        stockMarket: 'Stock Market',
        marketPool: 'Bank pool',
        stationTokensHeading: 'Stations',
        stationToken: 'station marker',
        depot: 'Supply'
    },
    // A system's par marker goes to the Systems box; its shares sell at its stock price (§7.3,
    // §7.5.2 step 8).
    companyPricePresentation: { ...DefaultCompanyPricePresentation, parRetired: isSystem },
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {
        [CslId]: 'Lay a free yellow tile in Burlington',
        [DhId]: 'Lay or upgrade a tile in Scranton for $120',
        [EkId]: 'Lay a yellow tile in Adrian/Ann Arbor'
    },
    // The C&A brings a PRR share; each $250 private its company's directorship; the C&P private
    // runs the C&P railway (§13.2.2).
    privateTokens: {
        [CaId]: { companyId: PrrId },
        [CpId]: { companyId: CobourgRailwayId },
        ...Object.fromEntries(
            DirectorPrivates1828.map(({ id, companyId }): [string, PrivateTokenPresentation] => [
                id,
                { companyId }
            ])
        )
    },
    autorunDescription: (companyId) =>
        companyId === CobourgRailwayId
            ? 'You lay its tile, then it takes the best run through it'
            : undefined,
    // The C&P's owner earns from the run its tile allows, so no figure is fixed (§13.2.2.5).
    projectsRun: (companyId) => companyId !== CobourgRailwayId,
    privateStatus: (state, privateCompanyId) =>
        privateCompanyId === CpId && privateOwner(state, privateCompanyId)?.kind !== 'company'
            ? `$Variable / ${money(CobourgCompanyRevenue)}`
            : undefined,
    privateHoldings(state, privateCompanyId) {
        if (privateCompanyId !== CpId || getCompany(state, CobourgRailwayId).closed)
            return undefined
        return `C&P treasury ${money(cobourgTreasury(state))}`
    },
    companyMarks: (state, companyId) =>
        coalHolders(requireState1828(state)).includes(companyId)
            ? [
                  {
                      label: 'Coal',
                      description: 'Coal marker: may build and run in the Virginia Coalfields.'
                  }
              ]
            : [],
    companyOrigin(state, companyId) {
        return isSystem(state, companyId)
            ? { text: 'System of', companyIds: constituents(state, companyId) }
            : undefined
    },
    companyFacts: shellFacts,
    historyMapPlacement: describe1828MapPlacement,
    // The printed market's regions (§12.1, §17).
    marketZones: [
        {
            color: 'yellow',
            name: 'Yellow par',
            description: 'A starting price from the yellow phase on: $67, $71 or $79.'
        },
        {
            color: 'green',
            name: 'Green par',
            description: 'A starting price from the green phase (the first 3-train): $86 or $94.'
        },
        {
            color: 'blue',
            name: 'Blue par',
            description: 'A starting price from the blue phase (the first 5-train): $105.'
        },
        {
            color: 'brown',
            name: 'Brown par',
            description: 'A starting price from the brown phase (the first 3+D-train): $120.'
        },
        {
            color: 'gray',
            name: 'Gray area',
            description:
                'Players may hold more than 60%; the director may buy two shares in a turn; a sold-out company rises one more row.',
            fill: { kind: 'solid', color: '#b4b8bb' }
        },
        {
            color: 'red',
            name: 'Game end',
            description:
                'A price reaching $500 ends the game: at once after a stock round, at the end of the operating round otherwise.'
        }
    ]
}
