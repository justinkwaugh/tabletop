import { Type, type Static } from '@sinclair/typebox'
import { PlayerColor } from './playerColors'

export type PlayerState = Static<typeof PlayerState>
export const PlayerState = Type.Object({
    playerId: Type.String(),
    color: Type.Enum(PlayerColor)
})
