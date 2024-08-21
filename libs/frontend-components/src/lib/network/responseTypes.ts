import { Type, type Static } from '@sinclair/typebox'
import { Game, GameAction, GameSyncStatus, User } from '@tabletop/common'

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
