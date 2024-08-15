import { Type, type Static } from '@sinclair/typebox'

export type PlayerState = Static<typeof PlayerState>
export const PlayerState = Type.Object({
    playerId: Type.String()
})
