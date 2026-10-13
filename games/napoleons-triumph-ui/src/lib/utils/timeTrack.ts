import type { Point } from '@tabletop/common'
import {
    roundDefinition,
    type HydratedNapoleonsTriumphGameState,
    type RoundDefinition
} from '@tabletop/napoleons-triumph'
import { mapFilePoint } from '$lib/map/battlefield.js'
import { CLEAR_OF_THE_PRINT, TRACK_COLUMN_PITCH } from './trackMarker.js'

// Measured on the designer's public map file, in its points; measure again if the board art changes.
const ROWS: Record<RoundDefinition['day'], { firstHourColumn: number; y: number }> = {
    1: { firstHourColumn: 1802, y: 3096 },
    2: { firstHourColumn: 1801, y: 3029 }
}
const FIRST_HOUR = 7
// The night after 1 December is printed at the head of 2 December's row.
const NIGHT = { row: ROWS[2], column: -1 }

function roundOnTheTrack(state: HydratedNapoleonsTriumphGameState): RoundDefinition {
    const latest = state.rounds.series.at(-1)
    return roundDefinition(state.scenario, latest ? latest.number - 1 : 0)
}

export function timeMarker(state: HydratedNapoleonsTriumphGameState): Point {
    const round = roundOnTheTrack(state)
    const { row, column } =
        round.hour === undefined ? NIGHT : { row: ROWS[round.day], column: round.hour - FIRST_HOUR }
    return mapFilePoint(
        row.firstHourColumn + column * TRACK_COLUMN_PITCH + CLEAR_OF_THE_PRINT,
        row.y
    )
}
