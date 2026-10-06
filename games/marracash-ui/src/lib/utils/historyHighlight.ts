import type { GameAction } from '@tabletop/common'
import {
    isBringVisitors,
    isMoveVisitors,
    isResolveAuction,
    isStartAuction,
    routeFrom,
    type FountainId,
    type Route,
    type ShopId,
    type ShopVisit
} from '@tabletop/marracash'

export type HistoryHighlight =
    | { kind: 'route'; route: Route; visits: readonly ShopVisit[] }
    | { kind: 'fountain'; fountainId: FountainId }
    | { kind: 'shop'; shopId: ShopId }

export function historyHighlightFor(action: GameAction): HistoryHighlight | undefined {
    if (isMoveVisitors(action)) {
        const route = routeFrom(action.fountainId, action.direction)
        if (!route) return undefined
        const visits = (action.metadata?.entries ?? []).map(({ shopId, customers }) => ({
            shopId,
            customers
        }))
        return { kind: 'route', route, visits }
    }
    if (isBringVisitors(action)) return { kind: 'fountain', fountainId: action.entranceId }
    if (isStartAuction(action)) return { kind: 'shop', shopId: action.shopId }
    if (isResolveAuction(action) && action.metadata) {
        return { kind: 'shop', shopId: action.metadata.shopId }
    }
    return undefined
}
