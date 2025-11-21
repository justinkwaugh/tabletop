import { Type, type Static } from 'typebox'
import { DateType } from '../../util/typebox.js'
import { Player } from './player.js'
import { GameResult, GameState } from './gameState.js'
import { GameConfig } from '../definition/gameConfig.js'
import { Compile } from 'typebox/compile'

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

export enum GameStorage {
    Local = 'local',
    Remote = 'remote',
    None = 'none'
}

export enum GameCategory {
    Standard = 'standard',
    Exploration = 'exploration'
}

export type Game = Static<typeof Game>
export const Game = Type.Object({
    id: Type.String(),
    typeId: Type.String(),
    status: Type.Enum(GameStatus),
    isPublic: Type.Boolean(),
    deleted: Type.Boolean(),
    deletedAt: Type.Optional(DateType()),
    ownerId: Type.String(),
    name: Type.String(),
    players: Type.Array(Player),
    config: GameConfig,
    hotseat: Type.Boolean(),
    state: Type.Optional(GameState),
    startedAt: Type.Optional(DateType()),
    finishedAt: Type.Optional(DateType()),
    createdAt: DateType(),
    updatedAt: Type.Optional(DateType()),
    activePlayerIds: Type.Optional(Type.Array(Type.String())),
    lastActionPlayerId: Type.Optional(Type.String()),
    lastActionAt: Type.Optional(DateType()),
    result: Type.Optional(Type.Enum(GameResult)),
    winningPlayerIds: Type.Array(Type.String()),
    seed: Type.Optional(Type.Number()),
    storage: Type.Optional(Type.Enum(GameStorage, { default: GameStorage.Remote })),
    parentId: Type.Optional(Type.String()),
    category: Type.Optional(Type.String({ default: GameCategory.Standard }))
})

export const GameValidator = Compile(Game)
