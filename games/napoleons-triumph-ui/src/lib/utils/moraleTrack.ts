import type { Point } from '@tabletop/common'
import { Side, type HydratedNapoleonsTriumphGameState } from '@tabletop/napoleons-triumph'
import { mapFilePoint } from '$lib/map/battlefield.js'
import { screenAxes } from './boardView.js'
import { MORALE_MARKER_SHARED_OFFSET, TRACK_COLUMN_PITCH } from './trackMarker.js'

// Measured on the designer's public map file, in its points; measure again if the board art changes.
const FIRST_BOX_CENTRE = 1865.75
const ROWS = [2957.5, 2891, 2824]
const BOXES_IN_A_ROW = 9
const HIGHEST_LEVEL = 27
const ON_THE_SCREEN_RIGHT_WHEN_SHARED: Record<Side, number> = {
    [Side.French]: -1,
    [Side.Allied]: 1
}

export enum GuardMark {
    Committed = 'committed',
    Failed = 'failed'
}

export interface MoraleMarker {
    playerId: string
    at: Point
    heavyCavalryCommitted: boolean
    guard?: GuardMark
}

export function moraleMarkers(
    state: HydratedNapoleonsTriumphGameState,
    rotation: number
): MoraleMarker[] {
    const armies = state.players.filter((player) => player.side && player.morale > 0)
    const right = screenAxes(rotation).right
    return armies.flatMap((player) => {
        const { playerId, side, morale } = player
        if (!side) {
            return []
        }
        const box = HIGHEST_LEVEL - morale
        const centre = mapFilePoint(
            FIRST_BOX_CENTRE + (box % BOXES_IN_A_ROW) * TRACK_COLUMN_PITCH,
            ROWS[Math.floor(box / BOXES_IN_A_ROW)]
        )
        const shared = armies.some((other) => other.side !== side && other.morale === morale)
        const offset = shared
            ? ON_THE_SCREEN_RIGHT_WHEN_SHARED[side] * MORALE_MARKER_SHARED_OFFSET
            : 0
        return [
            {
                playerId,
                at: { x: centre.x + right.x * offset, y: centre.y + right.y * offset },
                heavyCavalryCommitted: player.heavyCavalryCommitted,
                guard: player.guardAttackForfeited
                    ? GuardMark.Failed
                    : player.guardCommitted
                      ? GuardMark.Committed
                      : undefined
            }
        ]
    })
}
