export class TournamentError extends Error {
    constructor(
        message: string,
        readonly statusCode = 409
    ) {
        super(message)
    }
}
