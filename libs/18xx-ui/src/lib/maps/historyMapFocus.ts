import type { GameAction } from '@tabletop/common'
import {
    isPlaceStation, isLayTile, isLayPrivateTile, isRespondToTrackConsent, isRunTrains,
    nextOperatingCompany, type EighteenXXState
} from '@tabletop/18xx'
import { companyFocusLocations } from './companyFocusLocations.js'

export function historyMapFocus(state: EighteenXXState, action?: GameAction) {
    const routes = action && isRunTrains(action) ? action.routes : []
    if (routes.length) {
        return { locations: [...new Set(routes.flatMap((route) => [
            route.start.locationId, ...route.paths.map((path) => path.locationId)
        ]))], routes }
    }
    if (action && (isLayTile(action) || isLayPrivateTile(action))) {
        return { locations: [action.locationId], routes, selection: { kind: 'hex' as const, locationId: action.locationId } }
    }
    if (action && isRespondToTrackConsent(action) && action.metadata?.accepted) {
        const locationId = action.metadata.request.details.locationId
        return { locations: [locationId], routes, selection: { kind: 'hex' as const, locationId } }
    }
    if (action && isPlaceStation(action)) {
        const locationId = action.position.locationId
        return { locations: [locationId], routes, selection: { kind: 'hex' as const, locationId } }
    }
    const companyId = state.stockRound.completed && !state.result
        ? nextOperatingCompany(state) : undefined
    return { locations: companyId ? companyFocusLocations(state, companyId) : [], routes }
}
