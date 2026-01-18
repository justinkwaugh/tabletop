import * as Type from 'typebox'
import { assert, coordinatesToNumber, OffsetCoordinates, szudzikPairSigned } from '@tabletop/common'

export type SolarGate = Type.Static<typeof SolarGate>
export const SolarGate = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    innerCoords: Type.Optional(OffsetCoordinates),
    outerCoords: Type.Optional(OffsetCoordinates)
})

export function gateKey(coordsA?: OffsetCoordinates, coordsB?: OffsetCoordinates) {
    assert(coordsA && coordsB, 'Both coordinate must be defined to compute gateKey')

    const [innerCoords, outerCoords] =
        coordsA.row < coordsB.row ? [coordsA, coordsB] : [coordsB, coordsA]
    return szudzikPairSigned(coordinatesToNumber(innerCoords), coordinatesToNumber(outerCoords))
}
