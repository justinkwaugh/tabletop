import { type Static, Type } from 'typebox'
import { OffsetCoordinates } from '@tabletop/common'

export type SolarGate = Static<typeof SolarGate>
export const SolarGate = Type.Object({
    id: Type.String(),
    innerCoords: Type.Optional(OffsetCoordinates),
    outerCoords: Type.Optional(OffsetCoordinates),
    playerId: Type.String()
})
