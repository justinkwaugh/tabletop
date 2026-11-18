import { HexOrientation, type Point, type RectangleDimensions } from '@tabletop/common'

// Art plan, City marks and Cube slots: the marks and slots drawn inside a hex, in board units from
// its centre, for each way up a map's hexes stand.

export type TrackSlot = Point & RectangleDimensions

export type TrackSlotLayout = 'open-hex' | 'city' | 'east-coast-city' | 'chicago'

export type TrackSlotOffsets = {
    /** Every slot a hex of the layout has, in placement order. */
    readonly byLayout: Readonly<Record<TrackSlotLayout, readonly TrackSlot[]>>
    /** Where a hex holding one cube stands it, for the layouts that move it to the middle. */
    readonly lone: Partial<Record<TrackSlotLayout, TrackSlot>>
    /** Chicago's cubes by how many it holds. */
    readonly chicago: Readonly<Record<number, readonly TrackSlot[]>>
    /**
     * R-8.5: one cell of a city drawn over two (Berlin), by how many of the city's cubes it holds:
     * one in the middle, two side by side, small pairs and rows once the city holds five or six.
     */
    readonly twinCell: Readonly<Record<'one' | 'two' | 'smallTwo' | 'three', readonly TrackSlot[]>>
}

export type HexFrame = {
    readonly orientation: HexOrientation
    /** The hex's corners, in degrees clockwise from the top: a start band's spans turn at them. */
    readonly cornerAngles: readonly number[]
    /** The middle of a city's bonus pill, at the bottom centre of its hex. */
    readonly bonusPill: Point
    /** How far above the centre a mountain's peak stands, its base at this height. */
    readonly peakRise: number
    /**
     * The hex's sides towards each neighbour, in degrees from east, turning towards the south as
     * the board draws it, in the order a capacity mark tries them for open sea.
     */
    readonly capacitySides: readonly number[]
    readonly trackSlots: TrackSlotOffsets
}

function slot(x: number, y: number, width: number): TrackSlot {
    return { x, y, width, height: width }
}

// Art plan, Cube slots: every cube one size and in the same places but Chicago's, which holds six;
// each wholly inside its hex and apart from the next. A city's marks sit above them. A flat hex is
// shorter than a pointy one is, so Chicago's two rows stand a little higher there, above the pill
// at its bottom edge; every other slot fits either way up.
const CUBE_WIDTH = 26
const COLUMN_X = 16.8
const TRACK_Y = 2
const CHICAGO_WIDTH = 16
const CHICAGO_COLUMN_X = 19.6

/** The slots of a hex whose Chicago rows (R-4.1.3: a city with no limit) stand at these heights. */
function trackSlotOffsets(chicagoRowsY: readonly [number, number]): TrackSlotOffsets {
    // Chicago's cubes by how many it holds, in placement order: one full size in the middle, two
    // side by side like any city, then smaller: three straight across, then those three up a row
    // with the fourth below in the middle, the fifth splitting the bottom row in two, the sixth
    // making two rows of three.
    const [topRowY, bottomRowY] = chicagoRowsY
    const chicagoRow = [-CHICAGO_COLUMN_X, 0, CHICAGO_COLUMN_X]
    const chicagoHalfX = CHICAGO_COLUMN_X / 2
    return {
        // R-4.1.4: two cubes side by side, one in an East Coast city, Chicago two rows of three,
        // the back row first.
        byLayout: {
            'open-hex': [slot(-COLUMN_X, TRACK_Y, CUBE_WIDTH), slot(COLUMN_X, TRACK_Y, CUBE_WIDTH)],
            city: [slot(-COLUMN_X, TRACK_Y, CUBE_WIDTH), slot(COLUMN_X, TRACK_Y, CUBE_WIDTH)],
            'east-coast-city': [slot(0, TRACK_Y, CUBE_WIDTH)],
            chicago: chicagoRowsY.flatMap((y) => chicagoRow.map((x) => slot(x, y, CHICAGO_WIDTH)))
        },
        // A hex holding one cube stands it in the middle; a second moves it aside into the first
        // slot.
        lone: {
            'open-hex': slot(0, TRACK_Y, CUBE_WIDTH),
            city: slot(0, TRACK_Y, CUBE_WIDTH)
        },
        chicago: {
            1: [slot(0, TRACK_Y, CUBE_WIDTH)],
            2: [slot(-COLUMN_X, TRACK_Y, CUBE_WIDTH), slot(COLUMN_X, TRACK_Y, CUBE_WIDTH)],
            3: chicagoRow.map((x) => slot(x, TRACK_Y, CHICAGO_WIDTH)),
            4: [
                ...chicagoRow.map((x) => slot(x, topRowY, CHICAGO_WIDTH)),
                slot(0, bottomRowY, CHICAGO_WIDTH)
            ],
            5: [
                ...chicagoRow.map((x) => slot(x, topRowY, CHICAGO_WIDTH)),
                slot(-chicagoHalfX, bottomRowY, CHICAGO_WIDTH),
                slot(chicagoHalfX, bottomRowY, CHICAGO_WIDTH)
            ]
        },
        twinCell: {
            one: [slot(0, TRACK_Y, CUBE_WIDTH)],
            two: [slot(-COLUMN_X, TRACK_Y, CUBE_WIDTH), slot(COLUMN_X, TRACK_Y, CUBE_WIDTH)],
            smallTwo: [
                slot(-chicagoHalfX, TRACK_Y, CHICAGO_WIDTH),
                slot(chicagoHalfX, TRACK_Y, CHICAGO_WIDTH)
            ],
            three: chicagoRow.map((x) => slot(x, TRACK_Y, CHICAGO_WIDTH))
        }
    }
}

// A mountain's peak, near the top of the hex, its base this far above the centre.
const PEAK_RISE = 22.8

// A pointy hex: a corner at the top, the band starting there; its pill sits on its lower sides,
// above the bottom corner. Its sides face east first, then round by the north.
const POINTY_FRAME: HexFrame = {
    orientation: HexOrientation.Pointy,
    cornerAngles: [0, 60, 120, 180, 240, 300],
    bonusPill: { x: 0, y: 26.6 },
    peakRise: PEAK_RISE,
    capacitySides: [0, -60, -120, 180, 120, 60],
    trackSlots: trackSlotOffsets([-7.5, 9.5])
}

// A flat hex: an edge across the top, the band starting at its middle, so two colours split top to
// bottom as on a pointy hex; its pill sits just inside its bottom edge. Its sides face the
// north-east first, then round by the north.
const FLAT_FRAME: HexFrame = {
    orientation: HexOrientation.Flat,
    cornerAngles: [30, 90, 150, 210, 270, 330],
    bonusPill: { x: 0, y: 25.2 },
    peakRise: PEAK_RISE,
    capacitySides: [-30, -90, -150, 150, 90, 30],
    trackSlots: trackSlotOffsets([-9, 8])
}

export function hexFrame(orientation: HexOrientation): HexFrame {
    return orientation === HexOrientation.Pointy ? POINTY_FRAME : FLAT_FRAME
}
