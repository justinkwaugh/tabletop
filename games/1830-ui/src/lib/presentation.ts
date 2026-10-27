import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { EighteenThirtyCompanyNames } from './companyPresentation.js'
import { EighteenThirtyPhaseChart } from './phaseChart.js'
import { EighteenThirtyTrainColors } from './trainPresentation.js'

export const EighteenThirtyPresentation: TitlePresentation = {
    money: moneyFormat('$'),
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
    privateTokens: { CA: { companyId: 'PRR' }, BOP: { companyId: 'BO' }, MH: { companyId: 'NYC' } }
}
