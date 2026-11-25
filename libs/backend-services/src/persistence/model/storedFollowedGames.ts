import { Type, type Static } from 'typebox'

export const StoredFollowedGames = Type.Object({
    userId: Type.String(),
    gameIds: Type.Array(Type.String())
})
export type StoredFollowedGames = Static<typeof StoredFollowedGames>
