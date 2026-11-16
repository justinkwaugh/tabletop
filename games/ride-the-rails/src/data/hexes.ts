import * as Type from 'typebox'
import {
    addAxial,
    assertExists,
    PointyNeighborOffsets,
    type AxialCoordinates
} from '@tabletop/common'

// The default lets `Value.Create` build an action schema that holds a hex; every action sets its own.
export const HexId = Type.TemplateLiteral('hex.usa.${number}-${number}', { default: 'hex.usa.0-0' })
export type HexId = Type.Static<typeof HexId>

export type DoubledCoordinates = {
    row: number
    dcol: number
}

export function hexIdAt({ row, dcol }: DoubledCoordinates): HexId {
    return `hex.usa.${row}-${dcol}`
}

const HEX_ID_PATTERN = /^hex\.usa\.(\d+)-(\d+)$/

export function hexCoordinates(hexId: HexId): DoubledCoordinates {
    const match = HEX_ID_PATTERN.exec(hexId)
    assertExists(match, `Malformed hex id ${hexId}`)
    return { row: Number(match[1]), dcol: Number(match[2]) }
}

export function doubledToAxial({ row, dcol }: DoubledCoordinates): AxialCoordinates {
    return { q: (dcol - row) / 2, r: row }
}

export function axialToDoubled({ q, r }: AxialCoordinates): DoubledCoordinates {
    return { row: r, dcol: 2 * q + r }
}

// The neighbours of (r, d) are (r, d±2) and (r±1, d±1) (R-4.1.2, rules-interpretations.md, Ids and coordinates).
export function doubledNeighbours(coordinates: DoubledCoordinates): DoubledCoordinates[] {
    const axial = doubledToAxial(coordinates)
    return Object.values(PointyNeighborOffsets).map((offset) =>
        axialToDoubled(addAxial(axial, offset))
    )
}
