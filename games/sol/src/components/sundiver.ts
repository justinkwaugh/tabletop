import { type Static, Type } from 'typebox'
import { OffsetCoordinates } from '@tabletop/common'

export type Sundiver = Static<typeof Sundiver>
export const Sundiver = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    hold: Type.Optional(Type.String()), // Can be other players' holds
    reserve: Type.Boolean(),
    sacrificed: Type.Boolean(),
    coords: Type.Optional(OffsetCoordinates)
})
