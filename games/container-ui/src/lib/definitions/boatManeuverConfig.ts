import type { DockSlot } from '$lib/definitions/boatNavigation.js'

export type DockManeuverConfig = {
    undockReverseDistance: number
    undockReverseTurnRadius: number
    straightApproachDistances: number[]
    turnRadius: number
}

export const HARBOR_K_TURN_LATERAL_OFFSET = 108
export const HARBOR_K_TURN_REENTRY_DISTANCE = 132

export const OPEN_WATER_STRAIGHT_APPROACH_DISTANCES = [72, 120, 180]
export const OPEN_WATER_TURN_RADIUS = 118
export const OPEN_WATER_LONG_REVERSE_DISTANCE = 300
export const OPEN_WATER_SHARP_UNDOCK_CONFIG: DockManeuverConfig = {
    undockReverseDistance: 160,
    undockReverseTurnRadius: 36,
    straightApproachDistances: OPEN_WATER_STRAIGHT_APPROACH_DISTANCES,
    turnRadius: OPEN_WATER_TURN_RADIUS
}

export const DOCK_MANEUVER_CONFIG: Record<DockSlot['family'], DockManeuverConfig> = {
    'main-island-harbor': {
        undockReverseDistance: 100,
        undockReverseTurnRadius: 42,
        straightApproachDistances: [72, 120, 180],
        turnRadius: 132
    },
    'offshore-harbor': {
        undockReverseDistance: 100,
        undockReverseTurnRadius: 42,
        straightApproachDistances: [72, 120, 180],
        turnRadius: 132
    },
    'player-board': {
        undockReverseDistance: 52,
        undockReverseTurnRadius: 36,
        straightApproachDistances: [72, 120, 180],
        turnRadius: 118
    }
}
