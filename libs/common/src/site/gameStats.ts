import * as Type from 'typebox'
import { assertExists } from '../util/assertions.js'
import { findPlayerForUserId, GameCategory, type Game } from '../game/model/game.js'
import { GameResult } from '../game/model/gameResult.js'
import { MILLISECONDS_PER_DAY } from './siteStats.js'

export enum GameOutcome {
    Won = 'won',
    Tied = 'tied',
    Lost = 'lost'
}

export const GameStatsSummary = Type.Object({
    games: Type.Integer(),
    wins: Type.Integer(),
    ties: Type.Integer(),
    losses: Type.Integer(),
    winRate: Type.Number(),
    evenOddsWinRate: Type.Number(),
    bestWinStreak: Type.Integer(),
    currentWinStreak: Type.Integer(),
    firstFinishedAt: Type.Integer(),
    lastFinishedAt: Type.Integer(),
    averageDays: Type.Number(),
    tournamentGames: Type.Integer(),
    tournamentWins: Type.Integer(),
    opponentCount: Type.Integer(),
    finishes: Type.Optional(
        Type.Object({
            average: Type.Number(),
            averagePlayerCount: Type.Number()
        })
    ),
    recentOutcomes: Type.Array(Type.Enum(GameOutcome)),
    playerCounts: Type.Array(
        Type.Object({
            playerCount: Type.Integer(),
            games: Type.Integer(),
            winRate: Type.Number()
        })
    ),
    opponents: Type.Array(
        Type.Object({
            name: Type.String(),
            games: Type.Integer(),
            wins: Type.Integer(),
            opponentWins: Type.Integer()
        })
    )
})
export type GameStatsSummary = Type.Static<typeof GameStatsSummary>

export const TitleGameStats = Type.Object({
    titleId: Type.String(),
    summary: GameStatsSummary,
    bestScore: Type.Optional(Type.Number())
})
export type TitleGameStats = Type.Static<typeof TitleGameStats>

export const CountedGame = Type.Object({
    titleId: Type.String(),
    finishedAt: Type.Integer(),
    outcome: Type.Enum(GameOutcome)
})
export type CountedGame = Type.Static<typeof CountedGame>

export const UserGameStats = Type.Object({
    total: Type.Optional(GameStatsSummary),
    titles: Type.Array(TitleGameStats),
    countedGames: Type.Array(CountedGame)
})
export type UserGameStats = Type.Static<typeof UserGameStats>

export type GameStatsSource = Pick<
    Game,
    | 'id'
    | 'typeId'
    | 'players'
    | 'hotseat'
    | 'parentId'
    | 'category'
    | 'tournament'
    | 'result'
    | 'winningPlayerIds'
    | 'finalScores'
    | 'startedAt'
    | 'finishedAt'
>

type ScoredFinish = { finish: number; score: number; scoresOnlyMarkWinners: boolean }

type CountedGameFacts = CountedGame & {
    gameId: string
    days: number
    playerCount: number
    winShare: number
    scored?: ScoredFinish
    tournament: boolean
    opponents: { userId: string; name: string; won: boolean }[]
}

const RECENT_OUTCOMES = 20
const LISTED_OPPONENTS = 6

export function gameOutcome(game: Pick<Game, 'winningPlayerIds'>, playerId: string): GameOutcome {
    if (!game.winningPlayerIds.includes(playerId)) return GameOutcome.Lost
    return game.winningPlayerIds.length > 1 ? GameOutcome.Tied : GameOutcome.Won
}

export function evenOddsWinRate(playerCount: number): number {
    return 1 / playerCount
}

export function summarizeUserGames(
    games: readonly GameStatsSource[],
    userId: string
): UserGameStats {
    const counted = games
        .flatMap((game) => countedGameFacts(game, userId) ?? [])
        .sort((a, b) => a.finishedAt - b.finishedAt || a.gameId.localeCompare(b.gameId))
    if (counted.length === 0) return { titles: [], countedGames: [] }
    return {
        countedGames: counted.map(({ titleId, finishedAt, outcome }) => ({
            titleId,
            finishedAt,
            outcome
        })),
        total: summarize(counted),
        titles: [...groupBy(counted, (game) => game.titleId)]
            .map(([titleId, titleGames]) => ({
                titleId,
                summary: summarize(titleGames),
                bestScore: bestScore(titleGames)
            }))
            .sort((a, b) => b.summary.games - a.summary.games || a.titleId.localeCompare(b.titleId))
    }
}

export function isCountedGame(game: Pick<Game, 'hotseat' | 'parentId' | 'category'>): boolean {
    return (
        !game.hotseat && game.parentId === undefined && game.category !== GameCategory.Exploration
    )
}

function countedGameFacts(game: GameStatsSource, userId: string): CountedGameFacts | undefined {
    if (!isCountedGame(game)) return undefined
    const player = findPlayerForUserId(game, userId)
    if (!player) return undefined
    assertExists(game.result, 'Finished games require a result')
    if (game.result === GameResult.Abandoned) return undefined
    assertExists(game.startedAt, 'Finished games require a start timestamp')
    assertExists(game.finishedAt, 'Finished games require a completion timestamp')
    const winners = game.winningPlayerIds
    return {
        gameId: game.id,
        titleId: game.typeId,
        finishedAt: game.finishedAt.getTime(),
        days: (game.finishedAt.getTime() - game.startedAt.getTime()) / MILLISECONDS_PER_DAY,
        playerCount: game.players.length,
        outcome: gameOutcome(game, player.id),
        winShare: winners.includes(player.id) ? 1 / winners.length : 0,
        scored: scoredFinish(game, player.id),
        tournament: game.tournament !== undefined,
        opponents: game.players.flatMap((opponent) =>
            opponent.userId === undefined || opponent.userId === userId
                ? []
                : [
                      {
                          userId: opponent.userId,
                          name: opponent.name,
                          won: gameOutcome(game, opponent.id) === GameOutcome.Won
                      }
                  ]
        )
    }
}

function scoredFinish(
    game: Pick<Game, 'players' | 'winningPlayerIds' | 'finalScores'>,
    playerId: string
): ScoredFinish | undefined {
    const finalScores = game.finalScores
    if (!finalScores || !game.players.every((player) => Number.isFinite(finalScores[player.id])))
        return undefined
    const winners = game.winningPlayerIds
    const score = finalScores[playerId]
    const scoresOnlyMarkWinners = game.players.every(
        (player) => finalScores[player.id] === (winners.includes(player.id) ? 1 : 0)
    )
    if (winners.includes(playerId)) return { finish: 1, score, scoresOnlyMarkWinners }
    const higherScoringLosers = game.players.filter(
        (other) => !winners.includes(other.id) && finalScores[other.id] > score
    )
    return {
        finish: 1 + winners.length + higherScoringLosers.length,
        score,
        scoresOnlyMarkWinners
    }
}

function bestScore(games: CountedGameFacts[]): number | undefined {
    const scored = games.flatMap((game) => game.scored ?? [])
    if (scored.every((game) => game.scoresOnlyMarkWinners)) return undefined
    return Math.max(...scored.map((game) => game.score))
}

function finishes(games: CountedGameFacts[]): GameStatsSummary['finishes'] {
    const scored = games.flatMap((game) =>
        game.scored ? [{ finish: game.scored.finish, playerCount: game.playerCount }] : []
    )
    if (scored.length === 0) return undefined
    return {
        average: average(scored, (game) => game.finish),
        averagePlayerCount: average(scored, (game) => game.playerCount)
    }
}

function summarize(games: CountedGameFacts[]): GameStatsSummary {
    const count = (outcome: GameOutcome) => games.filter((game) => game.outcome === outcome).length
    const tournamentGames = games.filter((game) => game.tournament)
    const opponents = opponentRecords(games)
    return {
        games: games.length,
        wins: count(GameOutcome.Won),
        ties: count(GameOutcome.Tied),
        losses: count(GameOutcome.Lost),
        winRate: average(games, (game) => game.winShare),
        evenOddsWinRate: average(games, (game) => evenOddsWinRate(game.playerCount)),
        ...winStreaks(games),
        firstFinishedAt: games[0].finishedAt,
        lastFinishedAt: games[games.length - 1].finishedAt,
        averageDays: average(games, (game) => game.days),
        tournamentGames: tournamentGames.length,
        tournamentWins: tournamentGames.filter((game) => game.outcome === GameOutcome.Won).length,
        opponentCount: opponents.length,
        finishes: finishes(games),
        recentOutcomes: games.slice(-RECENT_OUTCOMES).map((game) => game.outcome),
        playerCounts: [...groupBy(games, (game) => game.playerCount)]
            .map(([playerCount, sized]) => ({
                playerCount,
                games: sized.length,
                winRate: average(sized, (game) => game.winShare)
            }))
            .sort((a, b) => a.playerCount - b.playerCount),
        opponents: opponents.slice(0, LISTED_OPPONENTS)
    }
}

function winStreaks(games: CountedGameFacts[]): {
    bestWinStreak: number
    currentWinStreak: number
} {
    let bestWinStreak = 0
    let currentWinStreak = 0
    for (const game of games) {
        currentWinStreak = game.outcome === GameOutcome.Won ? currentWinStreak + 1 : 0
        bestWinStreak = Math.max(bestWinStreak, currentWinStreak)
    }
    return { bestWinStreak, currentWinStreak }
}

function opponentRecords(games: CountedGameFacts[]): GameStatsSummary['opponents'] {
    const meetings = games.flatMap((game) =>
        game.opponents.map((opponent) => ({ opponent, outcome: game.outcome }))
    )
    return [...groupBy(meetings, (meeting) => meeting.opponent.userId).values()]
        .map((shared) => ({
            name: shared[shared.length - 1].opponent.name,
            games: shared.length,
            wins: shared.filter((meeting) => meeting.outcome === GameOutcome.Won).length,
            opponentWins: shared.filter((meeting) => meeting.opponent.won).length
        }))
        .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
}

function average<T>(items: T[], value: (item: T) => number): number {
    return items.reduce((total, item) => total + value(item), 0) / items.length
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>()
    for (const item of items) {
        const group = groups.get(key(item))
        if (group) group.push(item)
        else groups.set(key(item), [item])
    }
    return groups
}
