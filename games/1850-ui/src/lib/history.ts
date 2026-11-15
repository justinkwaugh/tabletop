import { isBuyStopRights, type StockMarketChart } from '@tabletop/18xx'
import { edgeAreaLocationIds, isClosure1850, isPlaceEdgeToken } from '@tabletop/1850'
import type { GameAction } from '@tabletop/common'
import type {
    HistoryDescription,
    HistoryMapPlacement,
    HistoryNames,
    MoneyFormat,
    TitleHistoryNames
} from '@tabletop/18xx-ui'
import {
    companyClosedRow,
    companyClosureDetails,
    describeShareAction,
    ownerName,
    stopRightsBoughtRow
} from '@tabletop/18xx-ui'

export function mapPlacement1850(action: GameAction): HistoryMapPlacement | undefined {
    return isPlaceEdgeToken(action) && action.metadata
        ? {
              kind: 'edge token',
              companyId: action.companyId,
              locationIds: edgeAreaLocationIds(action.metadata.locationId)
          }
        : undefined
}

export function describe1850Action(
    action: GameAction,
    names: HistoryNames & Pick<TitleHistoryNames, 'place'>,
    money: MoneyFormat,
    market: StockMarketChart
): HistoryDescription | undefined {
    const shareAction = describeShareAction(action, names, money, market)
    if (shareAction) return shareAction
    const { companyName, place } = names
    if (isBuyStopRights(action))
        return stopRightsBoughtRow(
            `${companyName(action.companyId)} bought a Mesabi Range token`,
            action.metadata,
            money
        )
    if (isPlaceEdgeToken(action))
        return {
            text: action.metadata
                ? `${companyName(action.companyId)} placed its edge token in ${place(action.metadata.locationId)}`
                : `${companyName(action.companyId)} placed its edge token`,
            ...(action.metadata ? { value: money(action.metadata.payment.amount) } : {})
        }
    if (isClosure1850(action) && action.metadata?.forfeit)
        return companyClosedRow(action.companyId, companyName, [
            ...companyClosureDetails(action.metadata, companyName),
            `${ownerName(action.metadata.forfeit.from, names)} lost ${money(action.metadata.forfeit.amount)}`
        ])
    return undefined
}
