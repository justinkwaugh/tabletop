import type { Point } from '@tabletop/common'
import { Side, type HydratedNapoleonsTriumphGameState } from '@tabletop/napoleons-triumph'
import { mapFilePoint } from '$lib/map/battlefield.js'
import { CLEAR_OF_THE_PRINT, TRACK_COLUMN_PITCH } from './trackMarker.js'

// Measured on the designer's public map file, in its points; measure again if the board art changes.
const FIRST_COLUMN = 1865.75
const ROWS = [2957.5, 2891, 2824]
const BOXES_IN_A_ROW = 9
const HIGHEST_LEVEL = 27
const IN_A_SHARED_BOX: Record<Side, number> = { [Side.Allied]: 14, [Side.French]: -14 }

export interface MoraleMarker {
    playerId: string
    at: Point
}

export function moraleMarkers(state: HydratedNapoleonsTriumphGameState): MoraleMarker[] {
    const armies = state.players.flatMap(({ playerId, side, morale }) =>
        side && morale > 0 ? [{ playerId, side, morale }] : []
    )
    return armies.map(({ playerId, side, morale }) => {
        const box = HIGHEST_LEVEL - morale
        const shared = armies.some((other) => other.side !== side && other.morale === morale)
        return {
            playerId,
            at: mapFilePoint(
                FIRST_COLUMN + (box % BOXES_IN_A_ROW) * TRACK_COLUMN_PITCH + CLEAR_OF_THE_PRINT,
                ROWS[Math.floor(box / BOXES_IN_A_ROW)] + (shared ? IN_A_SHARED_BOX[side] : 0)
            )
        }
    })
}
