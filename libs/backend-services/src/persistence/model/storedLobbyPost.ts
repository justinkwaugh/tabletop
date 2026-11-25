import { Type, type Static } from 'typebox'

export const LobbyMessage = Type.Object({
    channelId: Type.String(),
    messageId: Type.String()
})
export type LobbyMessage = Static<typeof LobbyMessage>

export const StoredLobbyPost = Type.Object({
    gameId: Type.String(),
    /** How many messages have announced the game, so only the first mentions the lobby's role. */
    posts: Type.Integer({ minimum: 0 }),
    message: Type.Optional(LobbyMessage)
})
export type StoredLobbyPost = Static<typeof StoredLobbyPost>
