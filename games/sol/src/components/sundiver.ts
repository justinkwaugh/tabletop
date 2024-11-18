import { Static, Type } from '@sinclair/typebox'
import { OffsetCoordinates } from '@tabletop/common'

export type Sundiver = Static<typeof Sundiver>
export const Sundiver = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    coords: Type.Optional(OffsetCoordinates)
})
