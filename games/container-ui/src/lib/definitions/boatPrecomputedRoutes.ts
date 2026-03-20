import type {
    BoatNavigationGeometry,
    RouteEndpoint
} from '$lib/definitions/boatNavigation.js'
import threePlayerNoOffshoreRoutes from '$lib/definitions/precomputedBoatRoutes/3p-no-offshore.json'
import { deserializeBoatRoutePlan, type PrecomputedBoatRoutesFile } from '$lib/definitions/boatRouteSerialization.js'
import type { BoatRoutePlan } from '$lib/definitions/boatPlanner.js'
import {
    getBoatRouteKey,
    getBoatRouteLayoutKey,
    type BoatRouteLayoutKey
} from '$lib/definitions/boatRouteKeys.js'

const PRECOMPUTED_BOAT_ROUTES_BY_LAYOUT: Partial<Record<BoatRouteLayoutKey, PrecomputedBoatRoutesFile>> =
    {
        '3p-no-offshore': threePlayerNoOffshoreRoutes as unknown as PrecomputedBoatRoutesFile
    }

export function getPrecomputedBoatRoutes(
    layoutKey: BoatRouteLayoutKey
): PrecomputedBoatRoutesFile | null {
    return PRECOMPUTED_BOAT_ROUTES_BY_LAYOUT[layoutKey] ?? null
}

export function getPrecomputedBoatRoutePlan(
    layoutKey: BoatRouteLayoutKey,
    start: RouteEndpoint,
    end: RouteEndpoint
): BoatRoutePlan | null {
    const layoutRoutes = getPrecomputedBoatRoutes(layoutKey)
    if (!layoutRoutes) {
        return null
    }

    const route = layoutRoutes.routes[getBoatRouteKey(start.canonicalId, end.canonicalId)]
    return route ? deserializeBoatRoutePlan(route, start, end) : null
}

export function getBoatRouteLayoutKeyForGeometry(
    geometry: BoatNavigationGeometry
): BoatRouteLayoutKey | null {
    if (geometry.layoutKey) {
        return geometry.layoutKey
    }

    const playerBoardDockCount = geometry.playerBoardDockSlots.length
    if (playerBoardDockCount % 4 !== 0) {
        return null
    }

    const playerCount = playerBoardDockCount / 4
    if (playerCount !== 3 && playerCount !== 4 && playerCount !== 5) {
        return null
    }

    const hasOffshore = geometry.offshoreDockSlots.length > 0
    return getBoatRouteLayoutKey(playerCount, hasOffshore)
}

export function getPrecomputedBoatRoutePlanForGeometry(
    geometry: BoatNavigationGeometry,
    start: RouteEndpoint,
    end: RouteEndpoint
): BoatRoutePlan | null {
    const layoutKey = getBoatRouteLayoutKeyForGeometry(geometry)
    return layoutKey ? getPrecomputedBoatRoutePlan(layoutKey, start, end) : null
}

export function getPrecomputedBoatRoutePlanForEndpoints(
    geometry: BoatNavigationGeometry,
    start: RouteEndpoint,
    end: RouteEndpoint
): BoatRoutePlan | null {
    const layoutKey = getBoatRouteLayoutKeyForGeometry(geometry)
    return layoutKey ? getPrecomputedBoatRoutePlan(layoutKey, start, end) : null
}
