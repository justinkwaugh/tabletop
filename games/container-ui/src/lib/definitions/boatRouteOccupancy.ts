import type { DockSlot, BoatPose } from '$lib/definitions/boatNavigation.js'

export function getFilledRouteOccupiedDockIds(
    dockSlots: DockSlot[],
    excludeDockIds: string[] = []
): Set<string> {
    const excluded = new Set(excludeDockIds)

    return new Set(
        dockSlots
            .filter((slot) => !excluded.has(slot.id))
            .map((slot) => slot.id)
    )
}

export function getFilledRouteOccupiedBoatPoses(
    dockSlots: DockSlot[],
    excludeDockIds: string[] = []
): BoatPose[] {
    const occupiedDockIds = getFilledRouteOccupiedDockIds(dockSlots, excludeDockIds)

    return dockSlots
        .filter((slot) => occupiedDockIds.has(slot.id))
        .map((slot) => slot.dockedPose)
}
