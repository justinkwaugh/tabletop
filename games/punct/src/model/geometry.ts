import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    distanceAxial,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    type AxialCoordinates
} from '@tabletop/common'

// The board is a hexagon nine spaces a side with its six corners cut off: 211 spaces.
export const BOARD_RADIUS = 8
// The central hexagon: every space within two of the middle, 19 in all.
export const CENTRE_RADIUS = 2

const ORIGIN: AxialCoordinates = { q: 0, r: 0 }
const COLUMNS = 'ABCDEFGHIJKLMNOPQ'

// Clockwise from north; a piece's rotation counts steps round this list.
export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

export function direction(step: number): AxialCoordinates {
    return DIRECTIONS[((step % 6) + 6) % 6]
}

export function spaceKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

function isCorner(coords: AxialCoordinates): boolean {
    const s = -coords.q - coords.r
    return [coords.q, coords.r, s].filter((value) => Math.abs(value) === BOARD_RADIUS).length === 2
}

export const SPACES: readonly AxialCoordinates[] = Array.from(
    hexSpiralPattern({ radius: BOARD_RADIUS, orientation: HexOrientation.Flat })()
).filter((coords) => !isCorner(coords))

const SPACE_KEYS = new Set(SPACES.map(spaceKey))

export function isSpace(coords: AxialCoordinates): boolean {
    return SPACE_KEYS.has(spaceKey(coords))
}

export function isCentre(coords: AxialCoordinates): boolean {
    return distanceAxial(coords, ORIGIN) <= CENTRE_RADIUS
}

export const CENTRE_SPACES: readonly AxialCoordinates[] = SPACES.filter(isCentre)

// Each pair of opposite sides lies at the two extremes of one axial coordinate: columns A and Q
// (q), and the two pairs of slanted sides (r and s).
export const AXES: readonly ((coords: AxialCoordinates) => number)[] = [
    (coords) => coords.q,
    (coords) => coords.r,
    (coords) => -coords.q - coords.r
]

export function neighbours(coords: AxialCoordinates): AxialCoordinates[] {
    return DIRECTIONS.map((offset) => addAxial(coords, offset)).filter(isSpace)
}

// The spaces along a straight line from a start, not counting it, to the board's edge.
export function lineFrom(start: AxialCoordinates, step: AxialCoordinates): AxialCoordinates[] {
    const line: AxialCoordinates[] = []
    let current = addAxial(start, step)
    while (isSpace(current)) {
        line.push(current)
        current = addAxial(current, step)
    }
    return line
}

// BoardSpace's names: columns A–Q left to right, numbers rising up each column and level along
// the lines running down to the right, so column A runs A2–A8 and column Q runs Q10–Q16.
export function spaceName(coords: AxialCoordinates): string {
    return `${COLUMNS[coords.q + BOARD_RADIUS]}${BOARD_RADIUS + 1 - coords.r}`
}

export function spaceAt(name: string): AxialCoordinates {
    const coords = {
        q: COLUMNS.indexOf(name[0].toUpperCase()) - BOARD_RADIUS,
        r: BOARD_RADIUS + 1 - Number(name.slice(1))
    }
    if (!isSpace(coords)) {
        throw Error(`No space ${name}`)
    }
    return coords
}
