import { assertExists } from '@tabletop/common'
import {
    isChooseDestinationStation,
    isStartDestinationRun,
    type StockMarketChart
} from '@tabletop/18xx'
import { company1870, isPlaceRevenueToken } from '@tabletop/1870'
import type { GameAction } from '@tabletop/common'
import type {
    HistoryDescription,
    HistoryMapPlacement,
    HistoryNames,
    MoneyFormat,
    TitleHistoryNames
} from '@tabletop/18xx-ui'
import { describeShareAction } from '@tabletop/18xx-ui'

const TokenNames = {
    cattle: 'Cattle',
    'open-port': 'open port',
    'closed-port': 'closed port'
} as const

export function mapPlacement1870(action: GameAction): HistoryMapPlacement | undefined {
    if (isPlaceRevenueToken(action))
        return {
            kind: `${TokenNames[action.kind]} token`,
            companyId: action.companyId,
            locationIds: [action.locationId]
        }
    if (isChooseDestinationStation(action) && action.onMap) {
        const destination = company1870(action.companyId)?.destination
        return destination
            ? {
                  kind: 'destination station',
                  companyId: action.companyId,
                  locationIds: [destination]
              }
            : undefined
    }
    return undefined
}

export function describe1870Action(
    action: GameAction,
    names: HistoryNames & Pick<TitleHistoryNames, 'place'>,
    money: MoneyFormat,
    market: StockMarketChart
): HistoryDescription | undefined {
    const shareAction = describeShareAction(action, names, money, market)
    if (shareAction) return shareAction
    const { companyName, place } = names
    if (isStartDestinationRun(action)) {
        const destination = company1870(action.companyId)?.destination
        assertExists(destination, 'A connection run reaches its company’s destination')
        return {
            text: `${companyName(action.companyId)} reached its destination, ${place(destination)}`,
            companyToken: action.companyId,
            omitActor: true,
            important: true,
            milestone: true
        }
    }
    if (isChooseDestinationStation(action))
        return {
            text: action.onMap
                ? 'Placed destination station'
                : 'Kept destination station as a $100 station'
        }
    if (isPlaceRevenueToken(action))
        return {
            text: `${companyName(action.companyId)} placed the ${TokenNames[action.kind]} token in ${place(action.locationId)}`
        }
    return undefined
}
