import { Type, type Static } from '@sinclair/typebox'
import { Color } from './colors.js'

export type PlayerState = Static<typeof PlayerState>
export const PlayerState = Type.Object({
    playerId: Type.String(),
    color: Type.Enum(Color)
})
