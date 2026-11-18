import {
    BoId,
    BopId,
    BsId,
    CocId,
    CpId,
    IpoPoolIdChesapeake,
    MapChesapeake,
    MarketPoolIdChesapeake,
    TitleRulesChesapeake
} from '@tabletop/18chesapeake'
import {
    moneyFormat,
    printedHomeCompanies,
    type MarketZone,
    type TitlePresentation
} from '@tabletop/18xx-ui'
import { CompanyNamesChesapeake } from './companyPresentation.js'
import { PhaseChartChesapeake, phaseChartChesapeake } from './phaseChart.js'
import { PhaseColorsChesapeake, TrainColorsChesapeake } from './trainPresentation.js'

export const PresentationChesapeake: TitlePresentation = {
    unstartedCompanies: printedHomeCompanies(MapChesapeake),
    money: moneyFormat(TitleRulesChesapeake.currencySymbol),
    phaseChart: PhaseChartChesapeake,
    phaseChartFor: phaseChartChesapeake,
    trainColors: TrainColorsChesapeake,
    phaseColors: PhaseColorsChesapeake,
    marketPoolId: MarketPoolIdChesapeake,
    ipoPoolId: IpoPoolIdChesapeake,
    companyNames: CompanyNamesChesapeake,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {
        [CpId]: 'Lay tiles 8 or 9 in H2 and I3, joined',
        [BsId]: 'Lay tiles 8 or 9 in F4 and G5, joined',
        [CocId]: 'Lay #57 in Berlin'
    },
    privateTokens: { [BopId]: { companyId: BoId } },
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A company’s starting price: $70, $80 or $95.' },
        {
            color: 'yellow',
            name: 'Yellow',
            description: 'Shares here do not count toward the certificate limit.',
            marksCompanyValue: true
        }
    ]
}

/** The Off the Rails market's zones. */
export const OffTheRailsMarketZones: readonly MarketZone[] = [
    { color: 'pink', name: 'Par', description: 'A company’s starting price: $67 to $100.' },
    {
        color: 'yellow',
        name: 'Yellow',
        description: 'Shares here do not count toward the certificate limit.',
        marksCompanyValue: true
    },
    {
        color: 'orange',
        name: 'Orange',
        description: 'Free of the certificate limit; a player may hold more than 60%.',
        marksCompanyValue: true
    },
    {
        color: 'brown',
        name: 'Brown',
        description: 'As orange, and several shares may be bought in one turn.',
        marksCompanyValue: true
    },
    {
        color: 'red',
        name: 'Game end',
        description:
            'A price reaching $300 ends the game: at once after a stock round, after the operating round otherwise.'
    }
]
