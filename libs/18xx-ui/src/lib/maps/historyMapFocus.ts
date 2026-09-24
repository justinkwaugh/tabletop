import {
    isDistributeEarnings,
    isPlaceStation,
    isLayTile,
    isLayPrivateTile,
    isRespondToTrackConsent,
    isRunTrains,
    nextOperatingCompany,
    type EighteenXXState,
    type TrainRoute
} from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'
import { companyFocusLocations } from './companyFocusLocations.js'

function historyRunRoutes(state: EighteenXXState, action?: GameAction): readonly TrainRoute[] {
    if (!action) return []
    if (isRunTrains(action)) return action.routes
    if (!isDistributeEarnings(action) || state.routeStep?.companyId !== action.companyId) return []
    assertExists(state.routeStep.result, 'Distributed earnings require the recorded train run')
    return state.routeStep.result.routes
}

export function historyMapFocus(state: EighteenXXState, action?: GameAction) {
    const routes = historyRunRoutes(state, action)
    if (routes.length) {
        return {
            locations: [
                ...new Set(
                    routes.flatMap((route) => [
                        route.start.locationId,
                        ...route.paths.map((path) => path.locationId)
                    ])
                )
            ],
            routes
        }
    }
    if (action && (isLayTile(action) || isLayPrivateTile(action))) {
        return {
            locations: [action.locationId],
            routes,
            selection: { kind: 'hex' as const, locationId: action.locationId }
        }
    }
    if (action && isRespondToTrackConsent(action) && action.metadata?.accepted) {
        const locationId = action.metadata.request.details.locationId
        return { locations: [locationId], routes, selection: { kind: 'hex' as const, locationId } }
    }
    if (action && isPlaceStation(action)) {
        const locationId = action.position.locationId
        return { locations: [locationId], routes, selection: { kind: 'hex' as const, locationId } }
    }
    const companyId =
        state.stockRound.completed && !state.result ? nextOperatingCompany(state) : undefined
    return { locations: companyId ? companyFocusLocations(state, companyId) : [], routes }
}
