import type { GameAction, Point } from '@tabletop/common'
import {
    isPlaceBuilding,
    isPlaceMerchant,
    isPlaceRooftop,
    isPlaceStable,
    isPlaceWall,
    type WallSection
} from '@tabletop/medina'

export type RecentPlacement = { playerId: string } & ({ space: Point } | { wall: WallSection })

export function placementOf(action: GameAction): RecentPlacement | undefined {
    const playerId = action.playerId
    if (!playerId) {
        return undefined
    }
    if (
        isPlaceBuilding(action) ||
        isPlaceRooftop(action) ||
        isPlaceStable(action) ||
        isPlaceMerchant(action)
    ) {
        return { playerId, space: action.coords }
    }
    if (isPlaceWall(action)) {
        return { playerId, wall: { side: action.side, position: action.position } }
    }
    return undefined
}

export type RecentViewer = { playerId?: string; acting: boolean }

// What changed since the viewer's last turn, newest first: their own turn in progress and everyone
// else's turns since. A viewer with no seat follows the latest turn only.
export function recentPlacements(actions: GameAction[], viewer: RecentViewer): RecentPlacement[] {
    const placements: RecentPlacement[] = []
    let seenOther = false
    for (const action of actions.toReversed()) {
        const placement = placementOf(action)
        if (!placement) {
            continue
        }
        if (placement.playerId === viewer.playerId) {
            if (seenOther || !viewer.acting) {
                break
            }
        } else {
            if (!viewer.playerId && placements.some((p) => p.playerId !== placement.playerId)) {
                break
            }
            seenOther = true
        }
        placements.push(placement)
    }
    return placements
}
