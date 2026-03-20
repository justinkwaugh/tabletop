import type { BoatPose, RouteEndpoint } from '$lib/definitions/boatNavigation.js'

export function getFilledRouteOccupiedDockIds(
    routeSlots: RouteEndpoint[],
    excludeSlotIds: string[] = []
): Set<string> {
    const excluded = new Set(excludeSlotIds)

    return new Set(
        routeSlots
            .filter((slot) => !excluded.has(slot.id))
            .map((slot) => slot.id)
    )
}

export function getFilledRouteOccupiedBoatPoses(
    routeSlots: RouteEndpoint[],
    excludeSlotIds: string[] = []
): BoatPose[] {
    const occupiedSlotIds = getFilledRouteOccupiedDockIds(routeSlots, excludeSlotIds)

    return routeSlots
        .filter((slot) => occupiedSlotIds.has(slot.id))
        .map((slot) => ('dockedPose' in slot ? slot.dockedPose : slot.parkedPose))
}
