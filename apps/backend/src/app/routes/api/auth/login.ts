import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { authSession } from '../../../lib/session.js'
import { caseInsensitiveSubject, operationBudget } from '../../../lib/operationBudget.js'

type LoginRequest = Static<typeof LoginRequest>
const LoginRequest = Type.Object({
    username: Type.String(),
    password: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LoginRequest }>(
        '/login',
        {
            config: { rateLimit: { max: 50, timeWindow: '1 minute' } },
            schema: { body: LoginRequest },
            preHandler: operationBudget<{ Body: LoginRequest }>(fastify, {
                operation: 'login',
                max: 20,
                timeWindow: '15 minutes',
                subject: (request) => caseInsensitiveSubject(request.body.username)
            })
        },
        async function (request, reply) {
            const { username, password } = request.body
            const user = await fastify.userService.getUserByUsernameAndPassword(username, password)
            if (!user) {
                await reply.code(401).send()
                return
            }
            await authSession({
                session: request.session,
                user,
                sessions: fastify.sessionService
            })
            fastify.log.info(`Found authed user ${JSON.stringify(user)}`)

            return { status: 'ok', payload: { user } }
        }
    )
}
