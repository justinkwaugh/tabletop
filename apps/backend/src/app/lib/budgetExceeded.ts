import type { FastifyInstance, FastifyReply } from 'fastify'

export type BudgetOutcome = Awaited<ReturnType<ReturnType<FastifyInstance['createRateLimit']>>>

export class BudgetExceededError extends Error {
    readonly statusCode = 429

    constructor(
        message: string,
        readonly retryAfterSeconds: number
    ) {
        super(message)
        this.name = 'BudgetExceededError'
    }
}

export function rejectWhenExceeded(reply: FastifyReply, outcome: BudgetOutcome, what: string) {
    if (outcome.isAllowed || !outcome.isExceeded) return
    void reply.header('retry-after', outcome.ttlInSeconds)
    throw new BudgetExceededError(
        `Too many ${what}, retry in ${outcome.ttlInSeconds} seconds`,
        outcome.ttlInSeconds
    )
}
