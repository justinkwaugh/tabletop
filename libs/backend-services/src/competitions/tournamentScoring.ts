import {
    assert,
    assertExists,
    GameResult,
    rankedTiebreak,
    ranksByAveragePlace,
    sortedEqualGroups,
    tournamentEntrantIndex,
    tournamentGameFinishingPlaces,
    tournamentRowRanksByPlace,
    tournamentShareOfWinner,
    tournamentTiebreakRule,
    type Game,
    type TiebreakRule,
    type Tournament,
    type TournamentFinishingPlaces,
    type TournamentScore
} from '@tabletop/common'

export function createTournamentStandings(tournament: Tournament): TournamentScore[] {
    return tournament.entrants.map(() => ({
        wins: 0,
        score: 0,
        completed: 0,
        ...(ranksByAveragePlace(tournament.rules) ? { placeTotal: 0 } : {})
    }))
}

export function withTournamentCredit(
    game: Pick<Game, 'players' | 'result' | 'winningPlayerIds'>,
    winningUserIds: string[]
): Pick<Game, 'players' | 'result' | 'winningPlayerIds'> {
    return {
        players: game.players,
        result: winningUserIds.length > 1 ? GameResult.Draw : GameResult.Win,
        winningPlayerIds: game.players
            .filter((player) => player.userId && winningUserIds.includes(player.userId))
            .map((player) => player.id)
    }
}

export type ComparableScore = Pick<
    TournamentScore,
    'score' | 'completed' | 'tiebreak' | 'pointsBehind' | 'shareOfWinner' | 'placeTotal'
>

export type RankableScore = ComparableScore & { userId: string }

export interface TournamentTableResult {
    id: string
    entrantIds: string[]
    winnerIds: string[]
    finishingPlaces?: TournamentFinishingPlaces
}

// A League season's Groups can straddle a title adopting a rule. Average final score is the one
// measure both rules hold.
function compareAcrossTiebreakRules(a: ComparableScore, b: ComparableScore): number {
    if (!a.completed || !b.completed) return b.completed - a.completed
    return (b.tiebreak ?? 0) / b.completed - (a.tiebreak ?? 0) / a.completed
}

function compareTiebreaks(a: ComparableScore, b: ComparableScore): number {
    if (tournamentTiebreakRule(a) !== tournamentTiebreakRule(b))
        return compareAcrossTiebreakRules(a, b)
    return (rankedTiebreak(b) ?? 0) - (rankedTiebreak(a) ?? 0)
}

// Cross-multiplied so equal averages of half-place totals compare exactly equal.
function comparePrimaryScores(a: ComparableScore, b: ComparableScore): number {
    if (!tournamentRowRanksByPlace(a) || !tournamentRowRanksByPlace(b)) return b.score - a.score
    if (!a.completed || !b.completed) return b.completed - a.completed
    return a.placeTotal * b.completed - b.placeTotal * a.completed
}

export function compareTournamentScores(a: ComparableScore, b: ComparableScore): number {
    return comparePrimaryScores(a, b) || compareTiebreaks(a, b)
}

export function tournamentPlacings<T extends RankableScore>(
    rows: T[],
    tables: TournamentTableResult[]
): T[][] {
    return sortedEqualGroups(rows, comparePrimaryScores).flatMap((level) =>
        (tournamentRowRanksByPlace(level[0]) ? headToHeadGroups(level, tables) : [level]).flatMap(
            (group) => sortedEqualGroups(group, compareTiebreaks)
        )
    )
}

function headToHeadGroups<T extends RankableScore>(
    tied: T[],
    tables: TournamentTableResult[]
): T[][] {
    if (tied.length < 2) return [tied]
    const finishedAhead = new Map(tied.map((row) => [row.userId, 0]))
    const count = (userId: string) => {
        const value = finishedAhead.get(userId)
        assertExists(value, `${userId} is not tied`)
        return value
    }
    for (const { finishingPlaces: places } of tables) {
        if (!places) continue
        const present = tied.filter((row) => places[row.userId] !== undefined)
        for (const row of present)
            for (const other of present) {
                const place = places[row.userId]
                const otherPlace = places[other.userId]
                if (row === other || place > otherPlace) continue
                finishedAhead.set(row.userId, count(row.userId) + (place < otherPlace ? 2 : 1))
            }
    }
    return sortedEqualGroups(tied, (a, b) => count(b.userId) - count(a.userId))
}

export interface TournamentGameScoreOptions {
    direction?: 1 | -1
    finalScores?: Record<string, number>
    correctedPlaces?: TournamentFinishingPlaces
}

export function applyTournamentGameScore(
    tournament: Tournament,
    standings: TournamentScore[],
    game: Pick<Game, 'players' | 'result' | 'winningPlayerIds'>,
    { direction = 1, finalScores, correctedPlaces }: TournamentGameScoreOptions = {}
): void {
    assert(game.result !== undefined && game.result !== GameResult.Abandoned, 'Game is unresolved')
    assert(
        new Set(game.winningPlayerIds).size === game.winningPlayerIds.length,
        'Duplicate winners'
    )
    assert(
        game.winningPlayerIds.every((id) => game.players.some((player) => player.id === id)),
        'Winner is not in the game'
    )
    assert(game.winningPlayerIds.length > 0, 'Finished game must declare winners')
    assert(
        !finalScores || game.players.every((player) => finalScores[player.id] !== undefined),
        'Final scores must cover every game player'
    )
    let scale = 1
    for (let divisor = 2; divisor <= tournament.rules.tableSize; divisor++) {
        let a = scale
        let b = divisor
        while (b) [a, b] = [b, a % b]
        scale = (scale / a) * divisor
    }
    const points = scale / game.winningPlayerIds.length
    const tiebreakRule = tournament.rules.tiebreakRule
    const topScore =
        finalScores && tiebreakRule
            ? Math.max(...game.players.map((player) => finalScores[player.id]))
            : undefined
    assert(
        tiebreakRule !== 'shareOfWinner' || topScore === undefined || topScore > 0,
        'Share of the winner needs a positive top score'
    )
    const places = placementPlaces(tournament, game, finalScores, correctedPlaces)
    for (const player of game.players) {
        assertExists(player.userId, 'Tournament seat has no account')
        const row = standings[tournamentEntrantIndex(tournament, player.userId)]
        assertExists(row, 'Game player is not a tournament entrant')
        row.completed += direction
        if (game.winningPlayerIds.includes(player.id)) {
            row.wins += direction
            row.score = (Math.round(row.score * scale) + direction * points) / scale
        }
        if (finalScores) row.tiebreak = (row.tiebreak ?? 0) + direction * finalScores[player.id]
        if (finalScores && tiebreakRule && topScore !== undefined)
            addRuleTiebreak(row, tiebreakRule, finalScores[player.id], topScore, direction)
        if (places) {
            assertExists(row.placeTotal, 'Placement standings start with a place total')
            row.placeTotal += direction * places[player.userId]
        }
    }
}

function addRuleTiebreak(
    row: TournamentScore,
    rule: TiebreakRule,
    finalScore: number,
    topScore: number,
    direction: 1 | -1
): void {
    switch (rule) {
        case 'pointsBehind':
            row.pointsBehind = (row.pointsBehind ?? 0) + direction * (topScore - finalScore)
            break
        case 'shareOfWinner':
            row.shareOfWinner =
                (row.shareOfWinner ?? 0) + direction * tournamentShareOfWinner(finalScore, topScore)
            break
    }
}

function placementPlaces(
    tournament: Tournament,
    game: Pick<Game, 'players' | 'winningPlayerIds'>,
    finalScores: Record<string, number> | undefined,
    correctedPlaces: TournamentFinishingPlaces | undefined
): TournamentFinishingPlaces | undefined {
    if (!ranksByAveragePlace(tournament.rules)) return undefined
    const places =
        correctedPlaces ?? (finalScores && tournamentGameFinishingPlaces(game, finalScores))
    assertExists(places, 'Placement scoring needs final scores or corrected places')
    assert(
        Object.keys(places).length === game.players.length &&
            game.players.every(
                (player) => player.userId !== undefined && places[player.userId] !== undefined
            ),
        'Places must cover every player exactly once'
    )
    return places
}

export function finalizeTournament(tournament: Tournament, now: number): void {
    if (tournament.status !== 'inProgress' || tournament.format.kind !== 'mini') return
    const stage = tournament.stages[0]
    const total =
        (tournament.entrants.length * tournament.format.stages[0].gamesPerEntrant) /
        tournament.rules.tableSize
    const dispatch = stage?.dispatch
    if (!dispatch || dispatch.finished.length + (dispatch.voided?.length ?? 0) !== total) return
    // Every Table can be void, so a finished event may have no scored Game. Void Tables also
    // leave Entrants with different counts, so only the total can be checked here.
    const standings = stage.standings ?? createTournamentStandings(tournament)
    stage.standings = standings
    assert(
        standings.reduce((sum, row) => sum + row.completed, 0) ===
            dispatch.finished.length * tournament.rules.tableSize,
        'Standings do not account for every game'
    )
    tournament.status = 'finished'
    tournament.finishedAt = now
    delete tournament.nextTaskAt
    delete tournament.paused
}
