import { Type, type Static } from 'typebox'
import {
    Bookmark,
    Game,
    GameAction,
    GameChat,
    GameChatMessage,
    GameSyncStatus,
    User
} from '@tabletop/common'

export type ApiResponse = Static<typeof ApiResponse>
export const ApiResponse = Type.Object({
    status: Type.String(),
    payload: Type.Optional(Type.Object({})),
    error: Type.Optional(Type.String())
})

export type UserResponse = Static<typeof UserResponse>
export const UserResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ user: User })
        })
    ])
)

export type UsernameSearchResponse = Static<typeof UsernameSearchResponse>
export const UsernameSearchResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ usernames: Type.Array(Type.String()) })
        })
    ])
)

export type GameResponse = Static<typeof GameResponse>
export const GameResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ game: Game })
        })
    ])
)

export type GameWithActionsResponse = Static<typeof GameWithActionsResponse>
export const GameWithActionsResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ game: Game, actions: Type.Array(GameAction) })
        })
    ])
)

export type HasActiveGamesResponse = Static<typeof HasActiveGamesResponse>
export const HasActiveGamesResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ hasActive: Type.Boolean() })
        })
    ])
)

export type GamesResponse = Static<typeof GamesResponse>
export const GamesResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ games: Type.Array(Game) })
        })
    ])
)

export type ActionsResponse = Static<typeof ActionsResponse>
export const ActionsResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ actions: Type.Array(GameAction) })
        })
    ])
)

export type ApplyActionResponse = Static<typeof ApplyActionResponse>
export const ApplyActionResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({
                actions: Type.Array(GameAction),
                game: Game,
                missingActions: Type.Optional(Type.Array(GameAction))
            })
        })
    ])
)

export type GameChatResponse = Static<typeof GameChatResponse>
export const GameChatResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ chat: GameChat })
        })
    ])
)

export type GameChatMessageResponsePayload = Static<typeof GameChatMessageResponsePayload>
export const GameChatMessageResponsePayload = Type.Evaluate(
    Type.Object({
        message: GameChatMessage,
        checksum: Type.Number(),
        missedMessages: Type.Array(GameChatMessage)
    })
)

export type GameChatMessageResponse = Static<typeof GameChatMessageResponse>
export const GameChatMessageResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: GameChatMessageResponsePayload
        })
    ])
)

export type BookmarkResponse = Static<typeof BookmarkResponse>
export const BookmarkResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ bookmark: Bookmark })
        })
    ])
)

export type TokenResponse = Static<typeof TokenResponse>
export const TokenResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ token: Type.String() })
        })
    ])
)

export type AblyTokenResponse = Static<typeof AblyTokenResponse>
export const AblyTokenResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({ token: Type.Unknown() })
        })
    ])
)

export type CheckSyncResponse = Static<typeof CheckSyncResponse>
export const CheckSyncResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({
                status: Type.Enum(GameSyncStatus),
                actions: Type.Array(GameAction),
                checksum: Type.Number()
            })
        })
    ])
)

export type UndoActionResponse = Static<typeof UndoActionResponse>
export const UndoActionResponse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(ApiResponse, ['payload']),
        Type.Object({
            payload: Type.Object({
                undoneActions: Type.Array(GameAction),
                game: Game,
                redoneActions: Type.Array(GameAction),
                checksum: Type.Number()
            })
        })
    ])
)
