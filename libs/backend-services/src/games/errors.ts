import { BaseError, Player, User } from '@tabletop/common'

enum GameServiceError {
    GameNotFound = 'GameNotFoundError',
    GamePlayerCountInvalid = 'GamePlayerCountInvalidError',
    GamePropertyIsRequired = 'GamePropertyIsRequiredError',
    GameNotWaitingForPlayers = 'GameNotWaitingForPlayersError',
    GameNotWaitingToStart = 'GameNotWaitingToStartError',
    GameNotInProgress = 'GameNotInProgressError',
    GameAlreadyStarted = 'GameAlreadyStartedError',
    GameUpdateCollisionError = 'GameUpdateCollisionError',
    PlayersNotFound = 'PlayersNotFoundError',
    PrivateGameNotFull = 'PrivateGameNotFullError',
    InvalidPlayerUser = 'InvalidPlayerUserError',
    InvalidPlayerId = 'InvalidPlayerIdError',
    UserIsNotAllowedPlayer = 'UserIsNotAllowedPlayerError',
    UserAlreadyJoined = 'UserAlreadyJoinedError',
    UserAlreadyDeclined = 'UserAlreadyDeclinedError',
    DuplicatePlayer = 'DuplicatePlayerError',
    UnauthorizedAccess = 'UnauthorizedAccessError',
    DisallowedUndo = 'DisallowedUndoError'
}

export class GamePlayerCountInvalidError extends BaseError {
    constructor({
        id,
        playerCount,
        minPlayers,
        maxPlayers
    }: {
        id: string
        playerCount: number
        minPlayers: number
        maxPlayers: number
    }) {
        super({
            name: GameServiceError.GamePlayerCountInvalid,
            message: `The game with id ${id} must have a player count between ${minPlayers} and ${maxPlayers}`,
            metadata: { id, playerCount, minPlayers, maxPlayers }
        })
    }
}

export class GamePropertyIsRequiredError extends BaseError {
    constructor({ id, field }: { id: string; field: string }) {
        super({
            name: GameServiceError.GamePropertyIsRequired,
            message: `The game with id ${id} requires that field ${field} is set`,
            metadata: { id, field }
        })
    }
}

export class GameNotWaitingForPlayersError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: GameServiceError.GameNotWaitingForPlayers,
            message: `The game with id ${id} was not in a waiting state`,
            metadata: { id }
        })
    }
}

export class GameNotWaitingToStartError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: GameServiceError.GameNotWaitingToStart,
            message: `The game with id ${id} was not ready to start`,
            metadata: { id }
        })
    }
}

export class GameNotInProgressError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: GameServiceError.GameNotInProgress,
            message: `The game with id ${id} is not in progress`,
            metadata: { id }
        })
    }
}

export class GameAlreadyStartedError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: GameServiceError.GameAlreadyStarted,
            message: `The game with id ${id} was already started`,
            metadata: { id }
        })
    }
}

export class GameNotFoundError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: GameServiceError.GameNotFound,
            message: `The game with id ${id} was not found`,
            metadata: { id }
        })
    }
}

export class GameUpdateCollisionError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: GameServiceError.GameUpdateCollisionError,
            message: `Game of with id ${id} was updated by another request simultaneously`,
            metadata: { id }
        })
    }
}

export class PlayersNotFoundError extends BaseError {
    constructor({ players }: { players: Player[] }) {
        super({
            name: GameServiceError.PlayersNotFound,
            message: `Players were not found`,
            metadata: { players }
        })
    }
}

export class PrivateGameNotFullError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: GameServiceError.PrivateGameNotFull,
            message: `The private game with id ${id} does not have enough players defined`,
            metadata: { id }
        })
    }
}

export class InvalidPlayerUserError extends BaseError {
    constructor({ user }: { user: User }) {
        super({
            name: GameServiceError.InvalidPlayerUser,
            message: `User is not valid`,
            metadata: { username: user.username, userId: user.id }
        })
    }
}

export class InvalidPlayerIdError extends BaseError {
    constructor({ playerId, gameId }: { playerId?: string; gameId: string }) {
        super({
            name: GameServiceError.InvalidPlayerId,
            message: `Player id ${playerId} is not valid for game with id ${gameId}`,
            metadata: { playerId, gameId }
        })
    }
}

export class UserIsNotAllowedPlayerError extends BaseError {
    constructor({ user, gameId }: { user: User; gameId: string }) {
        super({
            name: GameServiceError.UserIsNotAllowedPlayer,
            message: `User ${user.username} is not a player in game with id ${gameId}`,
            metadata: { username: user.username, userId: user.id, gameId }
        })
    }
}

export class UserAlreadyJoinedError extends BaseError {
    constructor({ user, gameId }: { user: User; gameId: string }) {
        super({
            name: GameServiceError.UserAlreadyJoined,
            message: `User ${user.username} has already joined the game with id ${gameId}`,
            metadata: { username: user.username, userId: user.id, gameId }
        })
    }
}

export class UserAlreadyDeclinedError extends BaseError {
    constructor({ user, gameId }: { user: User; gameId: string }) {
        super({
            name: GameServiceError.UserAlreadyDeclined,
            message: `User ${user.username} has already declined the game with id ${gameId}`,
            metadata: { username: user.username, userId: user.id, gameId }
        })
    }
}

export class DuplicatePlayerError extends BaseError {
    constructor({ username, userId }: { username: string; userId: string }) {
        super({
            name: GameServiceError.DuplicatePlayer,
            message: `User ${username} with id ${userId} is already a player in the game`,
            metadata: { username, userId }
        })
    }
}

export class UnauthorizedAccessError extends BaseError {
    constructor({ user, gameId }: { user: User; gameId: string }) {
        super({
            name: GameServiceError.UnauthorizedAccess,
            message: `User ${user.username} with id ${user.id} is not authorized to access game with id ${gameId}`,
            metadata: { userId: user.id, gameId: gameId }
        })
    }
}

export class DisallowedUndoError extends BaseError {
    constructor({
        gameId,
        actionId,
        reason
    }: {
        gameId: string
        actionId: string
        reason: string
    }) {
        super({
            name: GameServiceError.DisallowedUndo,
            message: `Action ${actionId} cannot be undone in game ${gameId} because ${reason}`,
            metadata: { gameId: gameId, actionId: actionId, reason: reason }
        })
    }
}
