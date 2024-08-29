import { Type, type Static } from '@sinclair/typebox'
import { HexCoordinates } from '@tabletop/common'

export type Island = Static<typeof Island>
export const Island = Type.Object({
    cells: Type.Array(HexCoordinates)
})
