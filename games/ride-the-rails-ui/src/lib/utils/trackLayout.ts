import { assertExists, type Point, type RectangleDimensions } from '@tabletop/common'
import { hexCapacity, RAILROAD_IDS, usaHex, type HexId } from '@tabletop/ride-the-rails'
import { hexCenter } from './boardGeometry.js'

export type TrackSlot = Point & RectangleDimensions

export type TrackSlotLayout = 'open-hex' | 'city' | 'east-coast-city' | 'chicago'

export const LOCOMOTIVE_ASPECT = 1.5

// R-4.1.3: one locomotive per railroad, so a hex with no limit never holds more than the six railroads.
export const MOST_LOCOMOTIVES_IN_A_HEX = RAILROAD_IDS.length

function slot(x: number, y: number, width: number): TrackSlot {
    return { x, y, width, height: width / LOCOMOTIVE_ASPECT }
}

const OPEN_HEX_WIDTH = 26
const CITY_WIDTH = 24
const CITY_TRACK_Y = 14
const CHICAGO_WIDTH = 16
const CHICAGO_ROW_Y = 17
const CHICAGO_COLUMN_X = 18

// R-4.1.4: two locomotives side by side, one in an East Coast city, Chicago two rows around its station.
const SLOT_OFFSETS: Readonly<Record<TrackSlotLayout, readonly TrackSlot[]>> = {
    'open-hex': [slot(-14.5, 0, OPEN_HEX_WIDTH), slot(14.5, 0, OPEN_HEX_WIDTH)],
    city: [slot(-13.5, CITY_TRACK_Y, CITY_WIDTH), slot(13.5, CITY_TRACK_Y, CITY_WIDTH)],
    'east-coast-city': [slot(0, CITY_TRACK_Y, CITY_WIDTH)],
    chicago: [-CHICAGO_ROW_Y, CHICAGO_ROW_Y].flatMap((y) =>
        [-CHICAGO_COLUMN_X, 0, CHICAGO_COLUMN_X].map((x) => slot(x, y, CHICAGO_WIDTH))
    )
}

export function trackSlotLayout(hexId: HexId): TrackSlotLayout {
    const capacity = hexCapacity(hexId)
    if (capacity === 'unlimited') return 'chicago'
    if (capacity === 1) return 'east-coast-city'
    return usaHex(hexId).terrain === 'city' ? 'city' : 'open-hex'
}

export function trackSlotOffsets(layout: TrackSlotLayout): readonly TrackSlot[] {
    return SLOT_OFFSETS[layout]
}

export function trackSlots(hexId: HexId): TrackSlot[] {
    const center = hexCenter(hexId)
    return trackSlotOffsets(trackSlotLayout(hexId)).map((offset) => ({
        ...offset,
        x: center.x + offset.x,
        y: center.y + offset.y
    }))
}

/** The slot of the hex's locomotive at this place in the hex's placement order. */
export function trackSlot(hexId: HexId, placementIndex: number): TrackSlot {
    const placedSlot = trackSlots(hexId)[placementIndex]
    assertExists(placedSlot, `Hex ${hexId} has no track slot ${placementIndex}`)
    return placedSlot
}
