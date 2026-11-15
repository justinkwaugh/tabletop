import * as Type from 'typebox'
import { CompanyClosure, closeShareCompany, type ZeroPriceClosureRules } from '@tabletop/18xx'
import { Market1846 } from './stock.js'
import type { HydratedEighteenFortySixState } from './state.js'
import { RevenueMarker } from './revenueMarkers.js'

export const RailroadClosure = Type.Object(
    { ...CompanyClosure.properties, removedRevenueMarkers: Type.Array(RevenueMarker) },
    { additionalProperties: false }
)
export type RailroadClosure = Type.Static<typeof RailroadClosure>

export function closeRailroad(
    state: HydratedEighteenFortySixState,
    companyId: string
): RailroadClosure {
    const removedRevenueMarkers = state.revenueMarkers.filter(
        (marker) => marker.companyId === companyId
    )
    const closure = closeShareCompany(state, companyId, 'removed')
    if (state.steamboat?.companyId === companyId) delete state.steamboat
    state.revenueMarkers = state.revenueMarkers.filter((marker) => marker.companyId !== companyId)
    return { ...closure, removedRevenueMarkers }
}

export const ZeroPriceClosure1846: ZeroPriceClosureRules<typeof RailroadClosure> = {
    market: Market1846,
    closure: {
        schema: RailroadClosure,
        close(state: HydratedEighteenFortySixState, companyId) {
            return closeRailroad(state, companyId)
        }
    }
}
