import {
    ChiId,
    IpoPoolIdMex,
    KcmoId,
    MarketMex,
    MarketPoolIdMex,
    MapMex,
    isMinorMex,
    MirId,
    MnrId,
    NdmId,
    TitleRulesMex
} from '@tabletop/18mex'
import { moneyFormat, printedHomeCompanies, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNamesMex } from './companyPresentation.js'
import { PhaseChartMex } from './phaseChart.js'
import { PhaseColorsMex, TrainColorsMex } from './trainPresentation.js'

const money = moneyFormat(TitleRulesMex.currencySymbol)
const pars = MarketMex.spaces.filter((space) => space.color === 'pink').map((space) => space.price)

export const PresentationMex: TitlePresentation = {
    money,
    phaseChart: PhaseChartMex,
    trainColors: TrainColorsMex,
    phaseColors: PhaseColorsMex,
    historyMarksEveryPhase: true,
    marketPoolId: MarketPoolIdMex,
    ipoPoolId: IpoPoolIdMex,
    companyNames: CompanyNamesMex,
    terms: { marketPool: 'Open Market' },
    unstartedCompanies: printedHomeCompanies(MapMex),
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: { [KcmoId]: 'Lay the Copper Canyon tile' },
    privateTokens: { [MirId]: { companyId: ChiId }, [MnrId]: { companyId: NdmId } },
    // A minor earns no fixed income: its owner takes half of each run (4.2).
    privateStatus: (_state, companyId) => (isMinorMex(companyId) ? 'Half its run' : undefined),
    marketZones: [
        {
            color: 'pink',
            name: 'Par',
            description: `A major’s starting price: ${pars.map(money).join(', ')}.`
        },
        {
            color: 'yellow',
            name: 'Yellow',
            description: 'Shares here do not count toward the certificate limit.',
            marksCompanyValue: true
        },
        {
            color: 'red',
            name: 'Game end',
            description:
                'A major reaching $200 ends the game after the current operating round, or the next after a stock round.'
        }
    ]
}
