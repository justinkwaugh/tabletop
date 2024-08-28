import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { authSession } from '../../../lib/session.js'

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
            schema: { body: LoginRequest }
        },
        async function (request, reply) {
            const { username, password } = request.body
            const user = await fastify.userService.getUserByUsernameAndPassword(username, password)
            if (!user) {
                await reply.code(401).send()
                return
            }
            fastify.log.info(`Found authed user ${JSON.stringify(user)}`)
            authSession({ session: request.session, userId: user.id })

            return { status: 'ok', payload: { user } }
        }
    )
}
