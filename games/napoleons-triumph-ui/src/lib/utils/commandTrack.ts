import type { Point } from '@tabletop/common'
import { Side, type HydratedNapoleonsTriumphGameState } from '@tabletop/napoleons-triumph'
import { MAP_FILE_SCALE, mapFilePoint } from '$lib/map/battlefield.js'
import { TRACK_COLUMN_PITCH } from './trackMarker.js'

const INDEPENDENT = undefined

interface CommandTrack {
    firstColumn: number
    rows: { y: number; boxes: (string | typeof INDEPENDENT)[] }[]
}

// Measured on the designer's public map file, in its points; measure again if the board art changes.
const TRACKS: Record<Side, CommandTrack> = {
    [Side.French]: {
        firstColumn: 2045.6,
        rows: [
            {
                y: 2613.4,
                boxes: ['bessieres', 'lannes', 'murat', 'vandamme', INDEPENDENT, INDEPENDENT]
            },
            {
                y: 2726.2,
                boxes: ['bernadotte', 'davout', 'legrand', 'st-hilaire', INDEPENDENT, INDEPENDENT]
            }
        ]
    },
    [Side.Allied]: {
        firstColumn: 81.6,
        rows: [
            {
                y: 2957.5,
                boxes: [
                    INDEPENDENT,
                    'prebyshevsky',
                    'liechtenstein',
                    'kollowrath',
                    'dokhturov',
                    'bagration'
                ]
            },
            {
                y: 3070.3,
                boxes: [
                    INDEPENDENT,
                    INDEPENDENT,
                    'miloradovich',
                    'langeron',
                    'kienmayer',
                    'constantine'
                ]
            }
        ]
    }
}

function boxesOf(side: Side): { commanderId: string | typeof INDEPENDENT; at: Point }[] {
    const track = TRACKS[side]
    return track.rows.flatMap((row) =>
        row.boxes.map((commanderId, column) => ({
            commanderId,
            at: mapFilePoint(track.firstColumn + column * TRACK_COLUMN_PITCH, row.y)
        }))
    )
}

const BOX_HALF_SIZE = TRACK_COLUMN_PITCH / 2

export function commandTrackCorners(side: Side): Point[] {
    const reach = BOX_HALF_SIZE * MAP_FILE_SCALE
    return boxesOf(side).flatMap(({ at }) => [
        { x: at.x - reach, y: at.y - reach },
        { x: at.x + reach, y: at.y + reach }
    ])
}

export function commandDiscs(state: HydratedNapoleonsTriumphGameState): Point[] {
    return state.players.flatMap((player) => {
        if (!player.side) {
            return []
        }
        const boxes = boxesOf(player.side)
        const commanded = boxes.filter(
            ({ commanderId }) =>
                commanderId !== INDEPENDENT &&
                state.commander(commanderId).commandsThisTurn !== undefined
        )
        const independent = boxes
            .filter(({ commanderId }) => commanderId === INDEPENDENT)
            .slice(0, player.independentCommandsUsed)
        return [...commanded, ...independent].map((box) => box.at)
    })
}
