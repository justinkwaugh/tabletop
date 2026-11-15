import { assertExists, type Point, type RectangleDimensions } from '@tabletop/common'
import {
    hexCapacity,
    isCityHex,
    RAILROAD_IDS,
    railroadsIn,
    type HexId,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { hexCenter } from './boardGeometry.js'
import { CUBE_UNIT } from './cubeShape.js'

export type TrackSlot = Point & RectangleDimensions

export type TrackSlotLayout = 'open-hex' | 'city' | 'east-coast-city' | 'chicago'

// R-4.1.3: one cube per railroad, so a hex with no limit never holds more than the six railroads.
export const MOST_LOCOMOTIVES_IN_A_HEX = RAILROAD_IDS.length

function slot(x: number, y: number, width: number): TrackSlot {
    return { x, y, width, height: width }
}

// Art plan, Cube slots: as large as each hex leaves room for, each cube wholly inside its hex and
// apart from the next; a city's sit low, under its bonus pill, passenger and capacity.
const OPEN_HEX_WIDTH = 29
const OPEN_HEX_COLUMN_X = 16.8
const OPEN_HEX_Y = 2
const CITY_WIDTH = 26
const CITY_COLUMN_X = 15.8
const CITY_TRACK_Y = 8
const EAST_COAST_WIDTH = 32
const EAST_COAST_TRACK_Y = 6.8
const CHICAGO_WIDTH = 17
const CHICAGO_ROWS_Y = [-0.4, 18] as const
const CHICAGO_COLUMN_X = 19.6

// R-4.1.4: two cubes side by side, one in an East Coast city, Chicago two rows of three, the back
// row first.
const SLOT_OFFSETS: Readonly<Record<TrackSlotLayout, readonly TrackSlot[]>> = {
    'open-hex': [
        slot(-OPEN_HEX_COLUMN_X, OPEN_HEX_Y, OPEN_HEX_WIDTH),
        slot(OPEN_HEX_COLUMN_X, OPEN_HEX_Y, OPEN_HEX_WIDTH)
    ],
    city: [
        slot(-CITY_COLUMN_X, CITY_TRACK_Y, CITY_WIDTH),
        slot(CITY_COLUMN_X, CITY_TRACK_Y, CITY_WIDTH)
    ],
    'east-coast-city': [slot(0, EAST_COAST_TRACK_Y, EAST_COAST_WIDTH)],
    chicago: CHICAGO_ROWS_Y.flatMap((y) =>
        [-CHICAGO_COLUMN_X, 0, CHICAGO_COLUMN_X].map((x) => slot(x, y, CHICAGO_WIDTH))
    )
}

export function trackSlotLayout(hexId: HexId): TrackSlotLayout {
    const capacity = hexCapacity(hexId)
    if (capacity === 'unlimited') return 'chicago'
    if (capacity === 1) return 'east-coast-city'
    return isCityHex(hexId) ? 'city' : 'open-hex'
}

export function trackSlots(hexId: HexId): TrackSlot[] {
    const center = hexCenter(hexId)
    return SLOT_OFFSETS[trackSlotLayout(hexId)].map((offset) => ({
        ...offset,
        x: center.x + offset.x,
        y: center.y + offset.y
    }))
}

/** The slot of the hex's cube at this place in the hex's placement order. */
export function trackSlot(hexId: HexId, placementIndex: number): TrackSlot {
    const placedSlot = trackSlots(hexId)[placementIndex]
    assertExists(placedSlot, `Hex ${hexId} has no track slot ${placementIndex}`)
    return placedSlot
}

/** A ghost cube: the cube a railroad would place in a lit hex, in the slot it would take. */
export type GhostCube = TrackSlot & { railroadId: RailroadId }

/** How far railroads sharing one slot stand apart, in cube units, and their size there. */
export const SHARED_GHOST_SPREAD = { x: 3.2, y: 1.4 } as const
export const SHARED_GHOST_SCALE = 0.7

/**
 * R-4.1.4: each railroad that may build in the hex, in the slot its placement would take: the
 * next free slot, a second railroad the one after. Where fewer slots are free than railroads,
 * all share the first free slot, smaller, spread from back left to front right.
 */
export function ghostCubes(
    hexId: HexId,
    track: Track,
    railroadIds: readonly RailroadId[]
): GhostCube[] {
    const free = trackSlots(hexId).slice(railroadsIn(track, hexId).length)
    if (free.length >= railroadIds.length) {
        return railroadIds.map((railroadId, index) => ({ ...free[index], railroadId }))
    }
    const shared = free[0]
    assertExists(shared, `Hex ${hexId} has no free track slot`)
    const cubeScale = shared.width / CUBE_UNIT
    const last = Math.max(railroadIds.length - 1, 1)
    return railroadIds.map((railroadId, index) => {
        const spread = (2 * index) / last - 1
        return {
            railroadId,
            x: shared.x + spread * SHARED_GHOST_SPREAD.x * cubeScale,
            y: shared.y + spread * SHARED_GHOST_SPREAD.y * cubeScale,
            width: shared.width * SHARED_GHOST_SCALE,
            height: shared.height * SHARED_GHOST_SCALE
        }
    })
}
