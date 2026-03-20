import type { RouteEndpoint } from '$lib/definitions/boatNavigation.js'

export type BoatRouteLayoutKey =
    | '3p-no-offshore'
    | '3p-offshore'
    | '4p-no-offshore'
    | '4p-offshore'
    | '5p-no-offshore'
    | '5p-offshore'

export function getBoatRouteLayoutKey(
    playerCount: 3 | 4 | 5,
    hasOffshore: boolean
): BoatRouteLayoutKey {
    return `${playerCount}p-${hasOffshore ? 'offshore' : 'no-offshore'}`
}

export function getBoatRouteKey(startId: string, endId: string): string {
    return `${startId}->${endId}`
}

function getPlayerBoardOwnerId(endpoint: RouteEndpoint): string | null {
    return endpoint.family === 'player-board' ? endpoint.id.split('-dock-')[0] ?? null : null
}

export function isGameplayRelevantBoatRoute(start: RouteEndpoint, end: RouteEndpoint): boolean {
    if (start.id === end.id) {
        return false
    }

    if (start.family === 'open-water' && end.family === 'open-water') {
        return false
    }

    if (start.family === 'player-board' && end.family === 'player-board') {
        return getPlayerBoardOwnerId(start) !== getPlayerBoardOwnerId(end)
    }

    const sameHarborFamily =
        start.family === end.family &&
        (start.family === 'main-island-harbor' || start.family === 'offshore-harbor')

    if (sameHarborFamily) {
        return false
    }

    return true
}
