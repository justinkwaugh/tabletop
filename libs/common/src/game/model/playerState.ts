import * as Type from 'typebox'
import { Color } from './colors.js'

export type PlayerState = Type.Static<typeof PlayerState>
export const PlayerState = Type.Object({
    playerId: Type.String(),
    color: Type.Enum(Color)
})
