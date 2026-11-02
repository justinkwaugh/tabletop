import type { FastifyInstance, FastifyReply, FastifyRequest, RouteGenericInterface } from 'fastify'
import { assertExists } from '@tabletop/common'
import { rejectWhenExceeded } from './budgetExceeded.js'

export interface OperationBudget<Route extends RouteGenericInterface> {
    operation: string
    max: number
    timeWindow: string
    subject: (request: FastifyRequest<Route>) => string
}

export const caseInsensitiveSubject = (value: string) => value.trim().toLowerCase()

export function authenticatedAccountSubject(request: FastifyRequest): string {
    assertExists(request.user, 'An account budget requires an authenticated user')
    return request.user.id
}

export function passwordAuthenticationBudget<Route extends RouteGenericInterface>(
    fastify: FastifyInstance,
    username: (request: FastifyRequest<Route>) => string
) {
    return operationBudget<Route>(fastify, {
        operation: 'login',
        max: 20,
        timeWindow: '15 minutes',
        subject: (request) => caseInsensitiveSubject(username(request))
    })
}

export function operationBudget<Route extends RouteGenericInterface>(
    fastify: FastifyInstance,
    budget: OperationBudget<Route>
) {
    const subjects = new WeakMap<FastifyRequest, string>()
    const consume = fastify.createRateLimit({
        max: budget.max,
        timeWindow: budget.timeWindow,
        keyGenerator: (request) => {
            const subject = subjects.get(request)
            assertExists(subject, 'An operation budget must resolve its subject before counting')
            return `${budget.operation}:${subject}`
        }
    })
    return async (request: FastifyRequest<Route>, reply: FastifyReply) => {
        subjects.set(request, budget.subject(request))
        rejectWhenExceeded(reply, await consume(request), `${budget.operation} attempts`)
    }
}
