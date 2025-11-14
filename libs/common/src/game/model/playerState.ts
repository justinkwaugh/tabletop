import { Type, type Static } from 'typebox'
import { Color } from './colors.js'

export type PlayerState = Static<typeof PlayerState>
export const PlayerState = Type.Object({
    playerId: Type.String(),
    color: Type.Enum(Color)
})
