import * as Type from 'typebox'
import { assertExists } from '../util/assertions.js'
import { findPlayerForUserId, GameCategory, type Game } from '../game/model/game.js'
import { GameResult } from '../game/model/gameResult.js'

export enum PlayOutcome {
    Won = 'won',
    Tied = 'tied',
    Lost = 'lost'
}

export const GameStatsSummary = Type.Object({
    plays: Type.Integer(),
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
    tournamentPlays: Type.Integer(),
    tournamentWins: Type.Integer(),
    opponentCount: Type.Integer(),
    finishes: Type.Optional(
        Type.Object({
            average: Type.Number(),
            averagePlayerCount: Type.Number()
        })
    ),
    recentOutcomes: Type.Array(Type.Enum(PlayOutcome)),
    playerCounts: Type.Array(
        Type.Object({
            playerCount: Type.Integer(),
            plays: Type.Integer(),
            winRate: Type.Number(),
            evenOddsWinRate: Type.Number()
        })
    ),
    opponents: Type.Array(
        Type.Object({
            name: Type.String(),
            plays: Type.Integer(),
            wins: Type.Integer(),
            opponentWins: Type.Integer()
        })
    )
})
export type GameStatsSummary = Type.Static<typeof GameStatsSummary>

export const TitleGameStats = Type.Object({
    titleId: Type.String(),
    summary: GameStatsSummary,
    scores: Type.Optional(
        Type.Object({
            best: Type.Number(),
            average: Type.Number()
        })
    )
})
export type TitleGameStats = Type.Static<typeof TitleGameStats>

export const CountedGame = Type.Object({
    titleId: Type.String(),
    finishedAt: Type.Integer(),
    outcome: Type.Enum(PlayOutcome)
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

type CountedPlay = {
    gameId: string
    titleId: string
    finishedAt: number
    days: number
    playerCount: number
    outcome: PlayOutcome
    winShare: number
    standing?: { finish: number; score: number }
    tournament: boolean
    opponents: { userId: string; name: string; won: boolean }[]
}

const RECENT_OUTCOMES = 20
const LISTED_OPPONENTS = 6
const MILLISECONDS_PER_DAY = 86_400_000

export function summarizeUserGames(
    games: readonly GameStatsSource[],
    userId: string
): UserGameStats {
    const plays = games
        .flatMap((game) => countedPlay(game, userId) ?? [])
        .sort((a, b) => a.finishedAt - b.finishedAt || a.gameId.localeCompare(b.gameId))
    if (plays.length === 0) return { titles: [], countedGames: [] }
    return {
        countedGames: plays.map(({ titleId, finishedAt, outcome }) => ({
            titleId,
            finishedAt,
            outcome
        })),
        total: summarize(plays),
        titles: [...groupBy(plays, (play) => play.titleId)]
            .map(([titleId, titlePlays]) => ({
                titleId,
                summary: summarize(titlePlays),
                scores: scores(titlePlays)
            }))
            .sort((a, b) => b.summary.plays - a.summary.plays || a.titleId.localeCompare(b.titleId))
    }
}

function countedPlay(game: GameStatsSource, userId: string): CountedPlay | undefined {
    if (game.hotseat || game.parentId !== undefined) return undefined
    if (game.category === GameCategory.Exploration) return undefined
    const player = findPlayerForUserId(game, userId)
    if (!player) return undefined
    assertExists(game.result, 'Finished games require a result')
    if (game.result === GameResult.Abandoned) return undefined
    assertExists(game.startedAt, 'Finished games require a start timestamp')
    assertExists(game.finishedAt, 'Finished games require a completion timestamp')
    const winners = game.winningPlayerIds
    const won = winners.includes(player.id)
    return {
        gameId: game.id,
        titleId: game.typeId,
        finishedAt: game.finishedAt.getTime(),
        days: (game.finishedAt.getTime() - game.startedAt.getTime()) / MILLISECONDS_PER_DAY,
        playerCount: game.players.length,
        outcome: !won ? PlayOutcome.Lost : winners.length > 1 ? PlayOutcome.Tied : PlayOutcome.Won,
        winShare: won ? 1 / winners.length : 0,
        standing: standing(game, player.id),
        tournament: game.tournament !== undefined,
        opponents: game.players.flatMap((opponent) =>
            opponent.userId === undefined || opponent.userId === userId
                ? []
                : [
                      {
                          userId: opponent.userId,
                          name: opponent.name,
                          won: winners.length === 1 && winners.includes(opponent.id)
                      }
                  ]
        )
    }
}

function standing(
    game: Pick<Game, 'players' | 'winningPlayerIds' | 'finalScores'>,
    playerId: string
): CountedPlay['standing'] {
    const finalScores = game.finalScores
    if (!finalScores) return undefined
    const score = finalScores[playerId]
    const winners = game.winningPlayerIds
    if (winners.includes(playerId)) return { finish: 1, score }
    const higherScoringLosers = game.players.filter(
        (other) => !winners.includes(other.id) && finalScores[other.id] > score
    )
    return { finish: 1 + winners.length + higherScoringLosers.length, score }
}

function scores(plays: CountedPlay[]): TitleGameStats['scores'] {
    const recorded = plays.flatMap((play) => play.standing?.score ?? [])
    if (recorded.length === 0) return undefined
    return { best: Math.max(...recorded), average: average(recorded, (score) => score) }
}

function finishes(plays: CountedPlay[]): GameStatsSummary['finishes'] {
    const placed = plays.flatMap((play) =>
        play.standing ? [{ finish: play.standing.finish, playerCount: play.playerCount }] : []
    )
    if (placed.length === 0) return undefined
    return {
        average: average(placed, (play) => play.finish),
        averagePlayerCount: average(placed, (play) => play.playerCount)
    }
}

function summarize(plays: CountedPlay[]): GameStatsSummary {
    const count = (outcome: PlayOutcome) => plays.filter((play) => play.outcome === outcome).length
    const tournamentPlays = plays.filter((play) => play.tournament)
    const opponents = opponentRecords(plays)
    return {
        plays: plays.length,
        wins: count(PlayOutcome.Won),
        ties: count(PlayOutcome.Tied),
        losses: count(PlayOutcome.Lost),
        winRate: average(plays, (play) => play.winShare),
        evenOddsWinRate: average(plays, (play) => 1 / play.playerCount),
        ...winStreaks(plays),
        firstFinishedAt: plays[0].finishedAt,
        lastFinishedAt: plays[plays.length - 1].finishedAt,
        averageDays: average(plays, (play) => play.days),
        tournamentPlays: tournamentPlays.length,
        tournamentWins: tournamentPlays.filter((play) => play.outcome === PlayOutcome.Won).length,
        opponentCount: opponents.length,
        finishes: finishes(plays),
        recentOutcomes: plays.slice(-RECENT_OUTCOMES).map((play) => play.outcome),
        playerCounts: [...groupBy(plays, (play) => play.playerCount)]
            .map(([playerCount, sized]) => ({
                playerCount,
                plays: sized.length,
                winRate: average(sized, (play) => play.winShare),
                evenOddsWinRate: 1 / playerCount
            }))
            .sort((a, b) => a.playerCount - b.playerCount),
        opponents: opponents.slice(0, LISTED_OPPONENTS)
    }
}

function winStreaks(plays: CountedPlay[]): { bestWinStreak: number; currentWinStreak: number } {
    let bestWinStreak = 0
    let currentWinStreak = 0
    for (const play of plays) {
        currentWinStreak = play.outcome === PlayOutcome.Won ? currentWinStreak + 1 : 0
        bestWinStreak = Math.max(bestWinStreak, currentWinStreak)
    }
    return { bestWinStreak, currentWinStreak }
}

function opponentRecords(plays: CountedPlay[]): GameStatsSummary['opponents'] {
    const shared = plays.flatMap((play) =>
        play.opponents.map((opponent) => ({ opponent, outcome: play.outcome }))
    )
    return [...groupBy(shared, (meeting) => meeting.opponent.userId).values()]
        .map((meetings) => ({
            name: meetings[meetings.length - 1].opponent.name,
            plays: meetings.length,
            wins: meetings.filter((meeting) => meeting.outcome === PlayOutcome.Won).length,
            opponentWins: meetings.filter((meeting) => meeting.opponent.won).length
        }))
        .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))
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
