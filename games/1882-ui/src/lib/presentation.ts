import {
    IpoPoolId1882,
    Map1882,
    MarketPoolId1882,
    NwrId,
    QLHome,
    QlId,
    ScrId,
    TitleRules1882,
    centralExchanger,
    startRestriction,
    type State1882
} from '@tabletop/1882'
import { moneyFormat, type TitlePresentation, type UnstartedCompanies } from '@tabletop/18xx-ui'
import { CompanyNames1882 } from './companyPresentation.js'
import { PhaseChart1882, phaseChart1882 } from './phaseChart.js'
import { PhaseColors1882, TrainColors1882 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1882.currencySymbol)

/**
 * The CN starts while a neutral station stands on the board; the SCR only from its private, its
 * home chosen then; the QL takes either of Regina's cities (§7.1.2, §10.4).
 */
const Unstarted1882: UnstartedCompanies<State1882> = {
    onOffer: (state, companyId) =>
        companyId === ScrId ? !!centralExchanger(state) : !startRestriction(state, companyId),
    home(_state, companyId) {
        if (companyId === ScrId) return 'chosen'
        if (companyId === QlId) return { locationIds: [QLHome] }
        return { locationIds: Map1882.reservedLocationIds(companyId) }
    }
}

export const Presentation1882: TitlePresentation<State1882> = {
    money,
    phaseChart: PhaseChart1882,
    phaseChartFor: phaseChart1882,
    trainColors: TrainColors1882,
    phaseColors: PhaseColors1882,
    marketPoolId: MarketPoolId1882,
    ipoPoolId: IpoPoolId1882,
    companyNames: CompanyNames1882,
    unstartedCompanies: Unstarted1882,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: { [NwrId]: 'Lay or upgrade a tile where the station moved' },
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A company’s starting price.' },
        {
            color: 'yellow',
            name: 'Yellow',
            description: 'Shares here do not count toward the certificate limit.'
        },
        {
            color: 'orange',
            name: 'Orange',
            description: 'Free of the certificate limit; a player may hold more than 60%.'
        },
        {
            color: 'brown',
            name: 'Brown',
            description: 'As orange, and several shares may be bought in one turn.'
        },
        {
            color: 'red',
            name: 'End',
            description:
                'A price reaching this space ends the game: at once after a stock round, after the operating round otherwise.'
        }
    ]
}
