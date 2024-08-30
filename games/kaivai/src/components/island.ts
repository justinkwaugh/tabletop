import { Type, type Static } from '@sinclair/typebox'
import { AxialCoordinates } from '@tabletop/common'

export type Island = Static<typeof Island>
export const Island = Type.Object({
    coordList: Type.Array(AxialCoordinates)
})
