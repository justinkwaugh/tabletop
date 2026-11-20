import { Shikoku1889Map, Shikoku1889TitleRules } from '@tabletop/shikoku-1889'
import { moneyFormat, printedHomeCompanies, type TitlePresentation } from '@tabletop/18xx-ui'
import { Shikoku1889CompanyNames } from './companyPresentation.js'
import { Shikoku1889PhaseChart } from './phaseChart.js'
import { Shikoku1889TrainColors } from './trainPresentation.js'

export const Shikoku1889Presentation: TitlePresentation = {
    unstartedCompanies: printedHomeCompanies(Shikoku1889Map),
    money: moneyFormat(Shikoku1889TitleRules.currencySymbol),
    phaseChart: Shikoku1889PhaseChart,
    trainColors: Shikoku1889TrainColors,
    phaseColors: Shikoku1889TrainColors,
    marketPoolId: 'open-market',
    ipoPoolId: 'initial-offering',
    companyNames: Shikoku1889CompanyNames,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: { MF: 'Place the port tile', ER: 'Place a tile in Ohzu' },
    privateTokens: { DR: { companyId: 'IR' }, MF: { tileSymbol: 'port' } },
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A price a company may start at.' },
        {
            color: 'yellow',
            name: 'Yellow',
            description: 'Shares here do not count toward the certificate limit.',
            marksCompanyValue: true
        },
        {
            color: 'orange',
            name: 'Orange',
            description: 'As yellow, and a player may hold more than 60%.',
            marksCompanyValue: true
        }
    ]
}
