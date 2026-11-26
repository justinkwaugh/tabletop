import { Type, type Static } from 'typebox'

export const LobbyMessage = Type.Object({
    channelId: Type.String(),
    messageId: Type.String()
})
export type LobbyMessage = Static<typeof LobbyMessage>

export const LobbyChannelPost = Type.Object({
    /** How many messages have announced the game here, so only the first mentions the role. */
    posts: Type.Integer({ minimum: 0 }),
    messageId: Type.Optional(Type.String())
})
export type LobbyChannelPost = Static<typeof LobbyChannelPost>

export const StoredLobbyPost = Type.Object({
    gameId: Type.String(),
    /** The game's post in each channel that has listed it, by channel id. */
    channels: Type.Record(Type.String(), LobbyChannelPost)
})
export type StoredLobbyPost = Static<typeof StoredLobbyPost>

/** A record written while each lobby had one channel; read as that channel's post. */
export const SingleChannelLobbyPost = Type.Object({
    gameId: Type.String(),
    posts: Type.Integer({ minimum: 0 }),
    message: Type.Optional(LobbyMessage)
})
export type SingleChannelLobbyPost = Static<typeof SingleChannelLobbyPost>
