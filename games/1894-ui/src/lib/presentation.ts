import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { EighteenNinetyFourCompanyNames } from './companyPresentation.js'
import { EighteenNinetyFourPhaseChart } from './phaseChart.js'
import {
    EighteenNinetyFourPhaseColors,
    EighteenNinetyFourTrainColors
} from './trainPresentation.js'

export const EighteenNinetyFourPresentation: TitlePresentation = {
    money: moneyFormat('F'),
    trainShortLabels: { D: 'D' },
    phaseChart: EighteenNinetyFourPhaseChart,
    trainColors: EighteenNinetyFourTrainColors,
    phaseColors: EighteenNinetyFourPhaseColors,
    marketPoolId: 'open-market',
    ipoPoolId: 'initial-offering',
    companyNames: EighteenNinetyFourCompanyNames,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {},
    privateTokens: {},
    // §10.1: the market's four regions.
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A price a company may start at.' },
        {
            color: 'light-pink',
            name: 'Starting par',
            description:
                'An extra par for the drawn French company and the Belge, and the price a reissue sets.',
            fill: { kind: 'solid', color: '#f8dde4' }
        },
        {
            color: 'gray',
            name: 'Gray area',
            description:
                'Shares do not count toward the certificate limit and may exceed 60%; the president may buy two at a time; a sold-out company rises one more space.',
            fill: { kind: 'solid', color: '#b4b8bb' }
        },
        { color: 'red', name: 'End', description: 'A share price reaching F450 ends the game.' }
    ]
}
