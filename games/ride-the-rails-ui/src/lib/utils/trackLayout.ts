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

// Art plan, Cube slots: every cube one size and in the same places but Chicago's, which holds six;
// each wholly inside its hex and apart from the next. A city's marks sit above them.
const CUBE_WIDTH = 26
const COLUMN_X = 16.8
const TRACK_Y = 2
const CHICAGO_WIDTH = 16
const CHICAGO_ROWS_Y = [-7.5, 9.5] as const
const CHICAGO_COLUMN_X = 19.6

// R-4.1.4: two cubes side by side, one in an East Coast city, Chicago two rows of three, the back
// row first.
const SLOT_OFFSETS: Readonly<Record<TrackSlotLayout, readonly TrackSlot[]>> = {
    'open-hex': [slot(-COLUMN_X, TRACK_Y, CUBE_WIDTH), slot(COLUMN_X, TRACK_Y, CUBE_WIDTH)],
    city: [slot(-COLUMN_X, TRACK_Y, CUBE_WIDTH), slot(COLUMN_X, TRACK_Y, CUBE_WIDTH)],
    'east-coast-city': [slot(0, TRACK_Y, CUBE_WIDTH)],
    chicago: CHICAGO_ROWS_Y.flatMap((y) =>
        [-CHICAGO_COLUMN_X, 0, CHICAGO_COLUMN_X].map((x) => slot(x, y, CHICAGO_WIDTH))
    )
}

// A hex holding one cube stands it in the middle; a second moves it aside into the first slot.
const LONE_CUBE: Partial<Record<TrackSlotLayout, TrackSlot>> = {
    'open-hex': slot(0, TRACK_Y, CUBE_WIDTH),
    city: slot(0, TRACK_Y, CUBE_WIDTH)
}

// Chicago's cubes by how many it holds, in placement order: one full size in the middle, two side
// by side like any city, then smaller: three straight across, then those three up a row with the
// fourth below in the middle, the fifth splitting the bottom row in two, the sixth making two rows
// of three.
const [TOP_ROW_Y, BOTTOM_ROW_Y] = CHICAGO_ROWS_Y
const CHICAGO_ROW = [-CHICAGO_COLUMN_X, 0, CHICAGO_COLUMN_X]
const CHICAGO_HALF_X = CHICAGO_COLUMN_X / 2
const CHICAGO_LAYOUTS: Readonly<Record<number, readonly TrackSlot[]>> = {
    1: [slot(0, TRACK_Y, CUBE_WIDTH)],
    2: [slot(-COLUMN_X, TRACK_Y, CUBE_WIDTH), slot(COLUMN_X, TRACK_Y, CUBE_WIDTH)],
    3: CHICAGO_ROW.map((x) => slot(x, TRACK_Y, CHICAGO_WIDTH)),
    4: [
        ...CHICAGO_ROW.map((x) => slot(x, TOP_ROW_Y, CHICAGO_WIDTH)),
        slot(0, BOTTOM_ROW_Y, CHICAGO_WIDTH)
    ],
    5: [
        ...CHICAGO_ROW.map((x) => slot(x, TOP_ROW_Y, CHICAGO_WIDTH)),
        slot(-CHICAGO_HALF_X, BOTTOM_ROW_Y, CHICAGO_WIDTH),
        slot(CHICAGO_HALF_X, BOTTOM_ROW_Y, CHICAGO_WIDTH)
    ]
}

function layoutOffsets(layout: TrackSlotLayout, held: number | undefined): readonly TrackSlot[] {
    if (layout === 'chicago') {
        return (held === undefined ? undefined : CHICAGO_LAYOUTS[held]) ?? SLOT_OFFSETS.chicago
    }
    const lone = held === 1 ? LONE_CUBE[layout] : undefined
    return lone ? [lone] : SLOT_OFFSETS[layout]
}

export function trackSlotLayout(hexId: HexId): TrackSlotLayout {
    const capacity = hexCapacity(hexId)
    if (capacity === 'unlimited') return 'chicago'
    if (capacity === 1) return 'east-coast-city'
    return isCityHex(hexId) ? 'city' : 'open-hex'
}

/** The hex's slots when it holds `held` cubes: a lone cube stands in the middle; Chicago's
 * cubes regroup as they arrive (CHICAGO_LAYOUTS). */
export function trackSlots(hexId: HexId, held?: number): TrackSlot[] {
    const center = hexCenter(hexId)
    return layoutOffsets(trackSlotLayout(hexId), held).map((offset) => ({
        ...offset,
        x: center.x + offset.x,
        y: center.y + offset.y
    }))
}

/** The slot of the hex's cube at this place in the hex's placement order, of `held` cubes. */
export function trackSlot(hexId: HexId, placementIndex: number, held: number): TrackSlot {
    const placedSlot = trackSlots(hexId, held)[placementIndex]
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
 * next free slot, a second railroad the one after; a lone railroad in an empty hex stands in
 * the middle, where its cube would. A hex's held cube stands aside for its ghosts (see
 * `locomotivePieces`). Where fewer slots are free than railroads, all share the first free
 * slot, smaller, spread from back left to front right.
 */
export function ghostCubes(
    hexId: HexId,
    track: Track,
    railroadIds: readonly RailroadId[]
): GhostCube[] {
    const held = railroadsIn(track, hexId).length
    const free = trackSlots(hexId, held === 0 && railroadIds.length === 1 ? 1 : undefined).slice(
        held
    )
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
