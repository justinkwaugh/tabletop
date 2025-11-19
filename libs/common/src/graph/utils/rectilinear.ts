import { OffsetCoordinates } from '../coordinates.js'

export function areOrthogonal(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates): boolean {
    return coordsA.row === coordsB.row || coordsA.col === coordsB.col
}
