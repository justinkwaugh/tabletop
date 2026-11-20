import * as Type from 'typebox'
import {
    addAxial,
    assertExists,
    FlatNeighborOffsets,
    HexOrientation,
    PointyNeighborOffsets,
    type AxialCoordinates
} from '@tabletop/common'
import { MAP_KEYS, type MapKey } from './maps.js'

// `hex.<map key>.<a>-<b>`: (row, dcol) on a pointy map, (col, drow) on a flat one. The default
// lets `Value.Create` build an action schema that holds a hex; every action sets its own.
export const HexId = Type.TemplateLiteral(
    [
        Type.Literal('hex.'),
        Type.Enum(MAP_KEYS),
        Type.Literal('.'),
        Type.Number(),
        Type.Literal('-'),
        Type.Number()
    ],
    { default: 'hex.usa.0-0' }
)
export type HexId = Type.Static<typeof HexId>

// A pointy map's hexes in rows: dcol is the doubled column, so row and dcol share their parity.
export type DoubledCoordinates = {
    row: number
    dcol: number
}

// A flat map's hexes in columns: drow is the doubled row, so col and drow share their parity.
export type FlatDoubledCoordinates = {
    col: number
    drow: number
}

const HEX_ID_PATTERN = /^hex\.([a-z]+)\.(\d+)-(\d+)$/

function isMapKey(key: string): key is MapKey {
    return MAP_KEYS.some((candidate) => candidate === key)
}

function hexIdParts(hexId: HexId): { mapKey: MapKey; a: number; b: number } {
    const match = HEX_ID_PATTERN.exec(hexId)
    assertExists(match, `Malformed hex id ${hexId}`)
    const [, mapKey, a, b] = match
    if (!isMapKey(mapKey)) {
        throw new Error(`Unknown map key in hex id ${hexId}`)
    }
    return { mapKey, a: Number(a), b: Number(b) }
}

export function mapKeyOfHex(hexId: HexId): MapKey {
    return hexIdParts(hexId).mapKey
}

// The USA's hexes, which are pointy: `hex.usa.<row>-<dcol>`.
export function hexIdAt(coordinates: DoubledCoordinates): HexId {
    return pointyHexId('usa', coordinates)
}

export function pointyHexId(mapKey: MapKey, { row, dcol }: DoubledCoordinates): HexId {
    return `hex.${mapKey}.${row}-${dcol}`
}

export function flatHexId(mapKey: MapKey, { col, drow }: FlatDoubledCoordinates): HexId {
    return `hex.${mapKey}.${col}-${drow}`
}

// A pointy map's hex id read as (row, dcol).
export function hexCoordinates(hexId: HexId): DoubledCoordinates {
    const { a, b } = hexIdParts(hexId)
    return { row: a, dcol: b }
}

// A flat map's hex id read as (col, drow).
export function flatHexCoordinates(hexId: HexId): FlatDoubledCoordinates {
    const { a, b } = hexIdParts(hexId)
    return { col: a, drow: b }
}

export function doubledToAxial({ row, dcol }: DoubledCoordinates): AxialCoordinates {
    return { q: (dcol - row) / 2, r: row }
}

export function axialToDoubled({ q, r }: AxialCoordinates): DoubledCoordinates {
    return { row: r, dcol: 2 * q + r }
}

export function flatToAxial({ col, drow }: FlatDoubledCoordinates): AxialCoordinates {
    return { q: col, r: (drow - col) / 2 }
}

export function axialToFlat({ q, r }: AxialCoordinates): FlatDoubledCoordinates {
    return { col: q, drow: 2 * r + q }
}

// The neighbours of (r, d) are (r, d±2) and (r±1, d±1) (R-4.1.2, rules-interpretations.md, Ids and coordinates).
export function doubledNeighbours(coordinates: DoubledCoordinates): DoubledCoordinates[] {
    const axial = doubledToAxial(coordinates)
    return Object.values(PointyNeighborOffsets).map((offset) =>
        axialToDoubled(addAxial(axial, offset))
    )
}

// On a flat map the neighbours of (c, d) are (c, d±2) and (c±1, d±1) (R-4.1.2).
export function flatNeighbours(coordinates: FlatDoubledCoordinates): FlatDoubledCoordinates[] {
    const axial = flatToAxial(coordinates)
    return Object.values(FlatNeighborOffsets).map((offset) => axialToFlat(addAxial(axial, offset)))
}

// The cell a hex id names, in axial coordinates, on a map of either orientation.
export function hexIdToAxial(orientation: HexOrientation, hexId: HexId): AxialCoordinates {
    return orientation === HexOrientation.Pointy
        ? doubledToAxial(hexCoordinates(hexId))
        : flatToAxial(flatHexCoordinates(hexId))
}

export function axialToHexId(
    orientation: HexOrientation,
    mapKey: MapKey,
    axial: AxialCoordinates
): HexId {
    return orientation === HexOrientation.Pointy
        ? pointyHexId(mapKey, axialToDoubled(axial))
        : flatHexId(mapKey, axialToFlat(axial))
}

// The ids of the six cells around a cell, in either orientation; some may be off the board.
export function neighbourCellIds(
    orientation: HexOrientation,
    mapKey: MapKey,
    axial: AxialCoordinates
): HexId[] {
    const offsets =
        orientation === HexOrientation.Pointy ? PointyNeighborOffsets : FlatNeighborOffsets
    return Object.values(offsets).map((offset) =>
        axialToHexId(orientation, mapKey, addAxial(axial, offset))
    )
}

// Reading order: a pointy map by row, then dcol; a flat map by drow, then col. Both run north to
// south, each line west to east.
export function compareReadingOrder(orientation: HexOrientation, a: HexId, b: HexId): number {
    if (orientation === HexOrientation.Pointy) {
        const first = hexCoordinates(a)
        const second = hexCoordinates(b)
        return first.row - second.row || first.dcol - second.dcol
    }
    const first = flatHexCoordinates(a)
    const second = flatHexCoordinates(b)
    return first.drow - second.drow || first.col - second.col
}
