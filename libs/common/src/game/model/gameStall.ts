import { MILLISECONDS_PER_DAY } from '../../site/siteStats.js'
import { GameCategory, GameStatus, GameStorage, type Game } from './game.js'

export const STALLED_GAME_AT_RISK_DAYS = 7
export const STALLED_GAME_ENDING_DAYS = 14
export const STALLED_GAME_END_DAYS = 30

export enum GameStallLevel {
    None = 'none',
    AtRisk = 'atRisk',
    Ending = 'ending',
    // Idle long enough for the host to end it; it plays on until the daily sweep does.
    Due = 'due'
}

type StallFields = Pick<
    Game,
    | 'status'
    | 'hotseat'
    | 'tournament'
    | 'storage'
    | 'category'
    | 'lastActionAt'
    | 'startedAt'
    | 'createdAt'
>

// Tournaments, leagues included, handle their own stalls.
function mayStall(game: StallFields): boolean {
    return (
        game.status === GameStatus.Started &&
        !game.hotseat &&
        !game.tournament &&
        game.storage !== GameStorage.Local &&
        game.category !== GameCategory.Exploration
    )
}

export function lastMoveAt(game: Pick<Game, 'lastActionAt' | 'startedAt' | 'createdAt'>): Date {
    return game.lastActionAt ?? game.startedAt ?? game.createdAt
}

export function gameStallLevel(game: StallFields, now: Date): GameStallLevel {
    if (!mayStall(game)) return GameStallLevel.None
    const idleDays = (now.getTime() - lastMoveAt(game).getTime()) / MILLISECONDS_PER_DAY
    if (idleDays >= STALLED_GAME_END_DAYS) return GameStallLevel.Due
    if (idleDays >= STALLED_GAME_ENDING_DAYS) return GameStallLevel.Ending
    if (idleDays >= STALLED_GAME_AT_RISK_DAYS) return GameStallLevel.AtRisk
    return GameStallLevel.None
}

export function stalledGameEndsAt(game: StallFields): Date {
    return new Date(lastMoveAt(game).getTime() + STALLED_GAME_END_DAYS * MILLISECONDS_PER_DAY)
}

export function daysUntilStalledGameEnds(game: StallFields, now: Date): number {
    return Math.ceil((stalledGameEndsAt(game).getTime() - now.getTime()) / MILLISECONDS_PER_DAY)
}
