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

/** Dispatch found a finished Table whose result it cannot read yet; the task is retried. */
export class TournamentResultsPendingError extends TournamentError {
    constructor(tableIds: string[]) {
        super(`The results of tables ${tableIds.join(', ')} are not available yet`, 503)
    }
}
