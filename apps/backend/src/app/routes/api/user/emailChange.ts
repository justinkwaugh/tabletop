import type { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { assertExists } from '@tabletop/common'
import { authSession } from '../../../lib/session.js'
import { authenticatedAccountSubject, operationBudget } from '../../../lib/operationBudget.js'

const EmailChangeRequest = Type.Object(
    {
        email: Type.String({ format: 'email', maxLength: 254 })
    },
    { additionalProperties: false }
)
type EmailChangeRequest = Static<typeof EmailChangeRequest>

const ConfirmEmailChangeRequest = Type.Object(
    {
        ...EmailChangeRequest.properties,
        code: Type.String({ minLength: 1, maxLength: 64 })
    },
    { additionalProperties: false }
)
type ConfirmEmailChangeRequest = Static<typeof ConfirmEmailChangeRequest>

export default async function (fastify: FastifyInstance) {
    const authorized = fastify.auth([fastify.verifyUser])

    fastify.get('/email/change', { onRequest: authorized }, async (request) => {
        assertExists(request.user, 'Email change lookup requires an Account')
        const pending = await fastify.userService.pendingEmailChange(request.user)
        return { status: 'ok', payload: { pending: pending ?? null } }
    })

    fastify.post<{ Body: EmailChangeRequest }>(
        '/email/change',
        {
            schema: { body: EmailChangeRequest },
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyUser, fastify.verifyRecentAuthentication], {
                relation: 'and'
            }),
            preHandler: operationBudget(fastify, {
                operation: 'email change',
                max: 10,
                timeWindow: '15 minutes',
                subject: authenticatedAccountSubject
            })
        },
        async (request) => {
            assertExists(request.authenticatedSession, 'Email change requires a session')
            const pending = await fastify.userService.requestEmailChange(
                request.authenticatedSession,
                request.body.email
            )
            return { status: 'ok', payload: { pending } }
        }
    )

    fastify.post<{ Body: ConfirmEmailChangeRequest }>(
        '/email/change/confirm',
        {
            schema: { body: ConfirmEmailChangeRequest },
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            onRequest: authorized
        },
        async (request) => {
            const session = request.authenticatedSession
            assertExists(session, 'Email change confirmation requires a session')
            const user = await fastify.userService.confirmEmailChange(
                session,
                request.body.email,
                request.body.code.trim()
            )
            await authSession({
                session: request.session,
                user,
                proof: { authenticatedAt: session.authenticatedAt },
                sessions: fastify.sessionService
            })
            await fastify.realtimeControl.revokeAccount(user.id)
            return { status: 'ok', payload: { user } }
        }
    )

    fastify.delete('/email/change', { onRequest: authorized }, async (request) => {
        assertExists(request.user, 'Email change cancellation requires an Account')
        await fastify.userService.cancelEmailChange(request.user.id)
        return { status: 'ok' }
    })
}
