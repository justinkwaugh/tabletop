import { type Static, Type } from 'typebox'
import { coordinatesToNumber, OffsetCoordinates, szudzikPairSigned } from '@tabletop/common'

export type SolarGate = Static<typeof SolarGate>
export const SolarGate = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    innerCoords: Type.Optional(OffsetCoordinates),
    outerCoords: Type.Optional(OffsetCoordinates)
})

export function gateKey(coordsA?: OffsetCoordinates, coordsB?: OffsetCoordinates) {
    if (!coordsA || !coordsB) {
        throw new Error('Both coordinates must be defined to compute gateKey')
    }

    const [innerCoords, outerCoords] =
        coordsA.row < coordsB.row ? [coordsA, coordsB] : [coordsB, coordsA]
    return szudzikPairSigned(coordinatesToNumber(innerCoords), coordinatesToNumber(outerCoords))
}
