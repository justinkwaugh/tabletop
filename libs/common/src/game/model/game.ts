import { Type, type Static } from '@sinclair/typebox'
import { Player } from './player.js'
import { GameResult, GameState } from './gameState.js'
import { GameConfig } from '../definition/gameConfig.js'

export enum GameStatus {
    WaitingForPlayers = 'waitingForPlayers',
    WaitingToStart = 'waitingToStart',
    Started = 'started',
    Finished = 'finished',
    Deleted = 'deleted',
    Archived = 'archived'
}

export enum GameStatusCategory {
    Active = 'active',
    Completed = 'completed',
    Deleted = 'deleted',
    Archived = 'archived'
}

export function getGameStatusesForCategory(category: GameStatusCategory): GameStatus[] {
    switch (category) {
        case GameStatusCategory.Active:
            return [GameStatus.WaitingForPlayers, GameStatus.WaitingToStart, GameStatus.Started]
        case GameStatusCategory.Completed:
            return [GameStatus.Finished]
        case GameStatusCategory.Deleted:
            return [GameStatus.Deleted]
        case GameStatusCategory.Archived:
            return [GameStatus.Archived]
    }
}

export enum GameSyncStatus {
    InSync = 'inSync',
    OutOfSync = 'outOfSync'
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
    lastActionAt: Type.Optional(Type.Date()),
    result: Type.Optional(Type.Enum(GameResult)),
    winningPlayerIds: Type.Array(Type.String()),
    seed: Type.Optional(Type.Number())
})
