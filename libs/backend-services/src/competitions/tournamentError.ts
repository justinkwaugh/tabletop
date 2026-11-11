export class CompetitionError extends Error {
    constructor(
        message: string,
        readonly statusCode = 409
    ) {
        super(message)
    }
}

export class TournamentError extends CompetitionError {}

export class LeagueError extends CompetitionError {}
