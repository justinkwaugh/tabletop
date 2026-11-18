import { EighteenThirtyMap, EighteenThirtyTitleRules } from '@tabletop/1830'
import { moneyFormat, printedHomeCompanies, type TitlePresentation } from '@tabletop/18xx-ui'
import { EighteenThirtyCompanyNames } from './companyPresentation.js'
import { EighteenThirtyPhaseChart } from './phaseChart.js'
import { EighteenThirtyTrainColors } from './trainPresentation.js'

export const EighteenThirtyPresentation: TitlePresentation = {
    unstartedCompanies: printedHomeCompanies(EighteenThirtyMap),
    money: moneyFormat(EighteenThirtyTitleRules.currencySymbol),
    phaseChart: EighteenThirtyPhaseChart,
    trainColors: EighteenThirtyTrainColors,
    phaseColors: EighteenThirtyTrainColors,
    marketPoolId: 'open-market',
    ipoPoolId: 'initial-offering',
    companyNames: EighteenThirtyCompanyNames,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {
        CS: 'Place a tile in Burlington',
        DH: 'Place #57 in Scranton'
    },
    privateTokens: { CA: { companyId: 'PRR' }, BOP: { companyId: 'BO' }, MH: { companyId: 'NYC' } },
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A price a corporation may start at.' },
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
        },
        {
            color: 'brown',
            name: 'Brown',
            description: 'As orange, and several market shares may be bought in one turn.',
            marksCompanyValue: true
        }
    ]
}
