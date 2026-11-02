import {
    assert,
    assertExists,
    GameResult,
    rankedTiebreak,
    tournamentEntrantIndex,
    type Game,
    type Tournament,
    type TournamentScore
} from '@tabletop/common'

export function createTournamentStandings(tournament: Tournament): TournamentScore[] {
    return tournament.entrants.map(() => ({ wins: 0, score: 0, completed: 0 }))
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
    'score' | 'completed' | 'tiebreak' | 'pointsBehind'
>

// A League season's Groups can straddle a title adopting a rule. Average final score is the one
// measure both rules hold.
function compareAcrossTiebreakRules(a: ComparableScore, b: ComparableScore): number {
    if (!a.completed || !b.completed) return b.completed - a.completed
    return (b.tiebreak ?? 0) / b.completed - (a.tiebreak ?? 0) / a.completed
}

function compareTiebreaks(a: ComparableScore, b: ComparableScore): number {
    if ((a.pointsBehind === undefined) !== (b.pointsBehind === undefined))
        return compareAcrossTiebreakRules(a, b)
    return (rankedTiebreak(b) ?? 0) - (rankedTiebreak(a) ?? 0)
}

export function compareTournamentScores(a: ComparableScore, b: ComparableScore): number {
    return b.score - a.score || compareTiebreaks(a, b)
}

export function applyTournamentGameScore(
    tournament: Tournament,
    standings: TournamentScore[],
    game: Pick<Game, 'players' | 'result' | 'winningPlayerIds'>,
    direction: 1 | -1 = 1,
    finalScores?: Record<string, number>
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
    const topScore =
        finalScores && tournament.rules.tiebreakRule === 'pointsBehind'
            ? Math.max(...game.players.map((player) => finalScores[player.id]))
            : undefined
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
        if (finalScores && topScore !== undefined) {
            row.pointsBehind =
                (row.pointsBehind ?? 0) + direction * (topScore - finalScores[player.id])
        }
    }
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
