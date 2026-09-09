import {
    assert,
    assertExists,
    GameResult,
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

export function applyTournamentGameScore(
    tournament: Tournament,
    standings: TournamentScore[],
    game: Pick<Game, 'players' | 'result' | 'winningPlayerIds'>,
    direction: 1 | -1 = 1
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
    let scale = 1
    for (let divisor = 2; divisor <= tournament.rules.tableSize; divisor++) {
        let a = scale
        let b = divisor
        while (b) [a, b] = [b, a % b]
        scale = (scale / a) * divisor
    }
    const points = scale / game.winningPlayerIds.length
    for (const player of game.players) {
        const row =
            standings[tournament.entrants.findIndex((entrant) => entrant.userId === player.userId)]
        assertExists(row, 'Game player is not a tournament entrant')
        row.completed += direction
        if (game.winningPlayerIds.includes(player.id)) {
            row.wins += direction
            row.score = (Math.round(row.score * scale) + direction * points) / scale
        }
    }
}

export function finalizeTournament(tournament: Tournament, now: number): void {
    if (tournament.status !== 'inProgress' || tournament.format.kind !== 'mini') return
    const stage = tournament.stages[0]
    const total =
        (tournament.entrants.length * tournament.format.stages[0].gamesPerEntrant) /
        tournament.rules.tableSize
    if (stage?.dispatch?.finished.length !== total) return
    assertExists(stage.standings, 'Finished tournament has no standings')
    assert(
        stage.standings.every(
            (row) => row.completed === tournament.format.stages[0].gamesPerEntrant
        ),
        'Standings do not account for every game'
    )
    tournament.status = 'finished'
    tournament.finishedAt = now
    delete tournament.nextTaskAt
    delete tournament.paused
}
