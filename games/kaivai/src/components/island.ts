import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'

export type Island = Type.Static<typeof Island>
export const Island = Type.Object({
    id: Type.String(),
    coordList: Type.Array(AxialCoordinates)
})
