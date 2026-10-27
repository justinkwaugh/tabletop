import type { FastifyInstance, FastifyReply, FastifyRequest, RouteGenericInterface } from 'fastify'

export class OperationBudgetExceededError extends Error {
    readonly statusCode = 429

    constructor(operation: string, retryAfterSeconds: number) {
        super(`Too many ${operation} attempts, retry in ${retryAfterSeconds} seconds`)
        this.name = 'OperationBudgetExceededError'
    }
}

export interface OperationBudget<Route extends RouteGenericInterface> {
    operation: string
    max: number
    timeWindow: string
    subject: (request: FastifyRequest<Route>) => string
}

export const caseInsensitiveSubject = (value: string) => value.trim().toLowerCase()

export function operationBudget<Route extends RouteGenericInterface>(
    fastify: FastifyInstance,
    budget: OperationBudget<Route>
) {
    const subjects = new WeakMap<FastifyRequest, string>()
    const consume = fastify.createRateLimit({
        max: budget.max,
        timeWindow: budget.timeWindow,
        keyGenerator: (request) => `${budget.operation}:${subjects.get(request) ?? ''}`
    })
    return async (request: FastifyRequest<Route>, reply: FastifyReply) => {
        subjects.set(request, budget.subject(request))
        const outcome = await consume(request)
        if (outcome.isAllowed || !outcome.isExceeded) return
        void reply.header('retry-after', outcome.ttlInSeconds)
        throw new OperationBudgetExceededError(budget.operation, outcome.ttlInSeconds)
    }
}
