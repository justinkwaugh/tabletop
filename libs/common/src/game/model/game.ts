import * as Type from 'typebox'
import { TournamentGameReference } from '../../site/tournamentGameReference.js'
import { DateType } from '../../util/typebox.js'
import { Player, PlayerStatus } from './player.js'
import { GameState } from './gameState.js'
import { GameResult } from './gameResult.js'
import { GameConfig } from './gameConfig.js'
import { PlayerVote } from './playerVote.js'
import { GameCall } from './gameCall.js'
import { GameProgress } from './gameProgress.js'
import { Compile } from 'typebox/compile'
import * as Value from 'typebox/value'

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

export type Game = Type.Static<typeof Game>
export const Game = Type.Object({
    id: Type.String(),
    typeId: Type.String(),
    series: Type.Optional(Type.String({ minLength: 1 })),
    status: Type.Enum(GameStatus),
    isPublic: Type.Boolean(),
    unlisted: Type.Optional(Type.Literal(true)),
    paceMinutes: Type.Optional(Type.Integer({ minimum: 1, maximum: 4_320 })),
    deleted: Type.Boolean(),
    deletedAt: Type.Optional(DateType()),
    ownerId: Type.String(),
    tournament: Type.Optional(TournamentGameReference),
    // A Tournament Game whose players may Concede, as in a Knockout Match.
    concedable: Type.Optional(Type.Literal(true)),
    name: Type.String(),
    players: Type.Array(Player),
    config: GameConfig,
    hotseat: Type.Boolean(),
    protectedInformation: Type.Optional(Type.Literal(true)),
    state: Type.Optional(GameState),
    autoStartAt: Type.Optional(DateType()),
    startedAt: Type.Optional(DateType()),
    finishedAt: Type.Optional(DateType()),
    createdAt: DateType(),
    updatedAt: Type.Optional(DateType()),
    activePlayerIds: Type.Optional(Type.Array(Type.String())),
    turnStartedAt: Type.Optional(Type.Record(Type.String(), DateType())),
    lastActionPlayerId: Type.Optional(Type.String()),
    lastActionAt: Type.Optional(DateType()),
    progress: Type.Optional(GameProgress),
    result: Type.Optional(Type.Enum(GameResult)),
    canContinue: Type.Optional(Type.Boolean()),
    continuedFromGameId: Type.Optional(Type.String()),
    winningPlayerIds: Type.Array(Type.String()),
    finalScores: Type.Optional(Type.Record(Type.String(), Type.Number())),
    everFinished: Type.Optional(Type.Literal(true)),
    seed: Type.Optional(Type.Number()),
    storage: Type.Optional(Type.Enum(GameStorage, { default: GameStorage.Remote })),
    parentId: Type.Optional(Type.String()),
    category: Type.Optional(Type.String({ default: GameCategory.Standard })),
    vote: Type.Optional(PlayerVote),
    call: Type.Optional(GameCall)
})

export type GameWithoutState = Type.Static<typeof GameWithoutState>
export const GameWithoutState = Type.Omit(Game, ['state'], { additionalProperties: false })

export function omitGameState(game: Game): GameWithoutState {
    const gameWithoutState = structuredClone(game)
    delete gameWithoutState.state
    const cleanedGame = Value.Clean(GameWithoutState, gameWithoutState)
    Value.Assert(GameWithoutState, cleanedGame)
    return cleanedGame
}

export function findPlayerForUserId(
    game: Pick<Game, 'players'>,
    userId: string
): Player | undefined {
    return game.players.find((player) => player.userId === userId)
}

export function ownerMayDeleteGame(
    game: Pick<Game, 'status' | 'storage' | 'everFinished'>
): boolean {
    return (
        game.storage === GameStorage.Local ||
        (game.status !== GameStatus.Finished && !game.everFinished)
    )
}

export function isListedPublicGame(game: Pick<Game, 'isPublic' | 'unlisted'>): boolean {
    return game.isPublic && game.unlisted !== true
}

export function isListedOpenGame(game: Pick<Game, 'isPublic' | 'unlisted' | 'status'>): boolean {
    return isListedPublicGame(game) && game.status === GameStatus.WaitingForPlayers
}

export function takenSeats(game: Pick<Game, 'players'>): number {
    return game.players.filter((player) => player.status !== PlayerStatus.Open).length
}

export function gameUserIds(game: Pick<Game, 'players' | 'ownerId' | 'tournament'>): string[] {
    const playerUserIds = game.players.flatMap((player) =>
        player.userId == null ? [] : [player.userId]
    )
    return [...new Set(game.tournament ? playerUserIds : [game.ownerId, ...playerUserIds])]
}

export const GAME_FOLLOW_LIMIT = 50

export function isFollowableGame(game: Pick<Game, 'hotseat' | 'category' | 'storage'>): boolean {
    return (
        (game.storage ?? GameStorage.Remote) === GameStorage.Remote &&
        !game.hotseat &&
        game.category !== GameCategory.Exploration
    )
}

const FOLLOWABLE_STATUSES = [
    ...getGameStatusesForCategory(GameStatusCategory.Active),
    ...getGameStatusesForCategory(GameStatusCategory.Completed)
]

export type FollowEligibility = Pick<
    Game,
    'players' | 'ownerId' | 'tournament' | 'hotseat' | 'category' | 'storage' | 'status'
>

export function canFollowGame(game: FollowEligibility, userId: string): boolean {
    return (
        isFollowableGame(game) &&
        FOLLOWABLE_STATUSES.includes(game.status) &&
        !gameUserIds(game).includes(userId)
    )
}

export const GameValidator = Compile(Game)
