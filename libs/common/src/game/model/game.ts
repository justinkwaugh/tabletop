import { Type, type Static } from '@sinclair/typebox'
import { Player } from './player.js'
import { GameState } from './gameState.js'
import { GameConfig } from '../definition/gameConfig.js'

export enum GameStatus {
    WaitingForPlayers = 'waitingForPlayers',
    WaitingToStart = 'waitingToStart',
    Started = 'started',
    Finished = 'finished',
    Deleted = 'deleted',
    Archived = 'archived'
}

export type Game = Static<typeof Game>
export const Game = Type.Object({
    id: Type.String(),
    typeId: Type.String(),
    status: Type.Enum(GameStatus),
    isPublic: Type.Boolean(),
    deleted: Type.Boolean(),
    deletedAt: Type.Optional(Type.Date()),
    ownerId: Type.String(),
    name: Type.String(),
    players: Type.Array(Player),
    config: GameConfig,
    hotseat: Type.Boolean(),
    state: Type.Optional(GameState),
    startedAt: Type.Optional(Type.Date()),
    finishedAt: Type.Optional(Type.Date()),
    createdAt: Type.Date(),
    updatedAt: Type.Optional(Type.Date()),
    activePlayerIds: Type.Optional(Type.Array(Type.String())),
    lastActionPlayerId: Type.Optional(Type.String()),
    lastActionAt: Type.Optional(Type.Date())
})
