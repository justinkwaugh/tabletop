import { Type, type Static } from '@sinclair/typebox'
import {
    Bookmark,
    Game,
    GameAction,
    GameChat,
    GameChatMessage,
    GameSyncStatus,
    User
} from '@tabletop/common'

export const Response = Type.Object({
    status: Type.String(),
    payload: Type.Optional(Type.Object({})),
    error: Type.Optional(Type.String())
})

export type UserResponse = Static<typeof UserResponse>
export const UserResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ user: User })
    })
])

export type UsernameSearchResponse = Static<typeof UsernameSearchResponse>
export const UsernameSearchResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ usernames: Type.Array(Type.String()) })
    })
])

export type GameResponse = Static<typeof GameResponse>
export const GameResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ game: Game })
    })
])

export type GameWithActionsResponse = Static<typeof GameWithActionsResponse>
export const GameWithActionsResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ game: Game, actions: Type.Array(GameAction) })
    })
])

export type GamesResponse = Static<typeof GamesResponse>
export const GamesResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ games: Type.Array(Game) })
    })
])

export type ActionsResponse = Static<typeof ActionsResponse>
export const ActionsResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ actions: Type.Array(GameAction) })
    })
])

export type ApplyActionResponse = Static<typeof ApplyActionResponse>
export const ApplyActionResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({
            actions: Type.Array(GameAction),
            game: Game,
            missingActions: Type.Optional(Type.Array(GameAction))
        })
    })
])

export type GameChatResponse = Static<typeof GameChatResponse>
export const GameChatResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ chat: GameChat })
    })
])

export type GameChatMessageResponse = Static<typeof GameChatMessageResponse>
export const GameChatMessageResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({
            message: GameChatMessage,
            checksum: Type.Number(),
            missedMessages: Type.Array(GameChatMessage)
        })
    })
])

export type BookmarkResponse = Static<typeof BookmarkResponse>
export const BookmarkResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ bookmark: Bookmark })
    })
])

export type TokenResponse = Static<typeof TokenResponse>
export const TokenResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ token: Type.String() })
    })
])

export type AblyTokenResponse = Static<typeof AblyTokenResponse>
export const AblyTokenResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({ token: Type.Unknown() })
    })
])

export type CheckSyncResponse = Static<typeof CheckSyncResponse>
export const CheckSyncResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({
            status: Type.Enum(GameSyncStatus),
            actions: Type.Array(GameAction),
            checksum: Type.Number()
        })
    })
])

export type UndoActionResponse = Static<typeof UndoActionResponse>
export const UndoActionResponse = Type.Composite([
    Type.Omit(Response, ['payload']),
    Type.Object({
        payload: Type.Object({
            undoneActions: Type.Array(GameAction),
            game: Game,
            redoneActions: Type.Array(GameAction),
            checksum: Type.Number()
        })
    })
])
