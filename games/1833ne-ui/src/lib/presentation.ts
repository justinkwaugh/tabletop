import { MarketZones1833NE, type State1833NE } from '@tabletop/1833ne'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1833NE } from './companyPresentation.js'
import { PhaseChart1833NE } from './phaseChart.js'
import { PhaseColors1833NE, TrainColors1833NE } from './trainPresentation.js'

export const Presentation1833NE: TitlePresentation<State1833NE> = {
    money: moneyFormat('$'),
    companyNames: CompanyNames1833NE,
    marketPoolId: 'open-market',
    trainColors: TrainColors1833NE,
    phaseColors: PhaseColors1833NE,
    phaseChart: PhaseChart1833NE,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: { P3: 'Lay free tiles in St. Jean (C4) and C6' },
    marketCell: { width: 36, height: 96 },
    marketZones: [
        {
            color: MarketZones1833NE.launch,
            name: 'Launch',
            banner: { label: 'Initial prices', shape: 'span' },
            description: 'A price a corporation may be launched at.'
        },
        {
            color: MarketZones1833NE.tripleJump,
            name: 'Triple jump',
            banner: { label: 'Triple jump', shape: 'arrow' },
            description:
                'A payout of at least three times the share price moves the price three spaces right.'
        }
    ]
}
