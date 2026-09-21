import type { TitlePresentation } from '@tabletop/18xx-ui'
import { Shikoku1889CompanyNames } from './companyPresentation.js'
import { Shikoku1889PhaseChart } from './phaseChart.js'
import { Shikoku1889TrainColors } from './trainPresentation.js'

export const Shikoku1889Presentation: TitlePresentation = {
    phaseChart: Shikoku1889PhaseChart,
    trainColors: Shikoku1889TrainColors,
    phaseColors: Shikoku1889TrainColors,
    marketPoolId: 'open-market',
    companyNames: Shikoku1889CompanyNames,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: { MF: 'Place the port tile', ER: 'Place a tile in Ohzu' }
}
