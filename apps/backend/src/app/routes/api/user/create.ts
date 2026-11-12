import { FastifyInstance } from 'fastify'
import { Role, UserCreateRequest, UserStatus } from '@tabletop/common'
import { nanoid } from 'nanoid'
import { authSession } from '../../../lib/session.js'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UserCreateRequest }>(
        '/create',
        {
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            schema: { body: UserCreateRequest }
        },
        async function (request, _reply) {
            if (request.user) {
                throw Error('User already has valid session')
            }

            const newUser = {
                id: nanoid(),
                username: request.body.username.trim(),
                status: UserStatus.Incomplete,
                externalIds: [],
                email: request.body.email.trim(),
                emailVerified: false,
                roles: [Role.User]
            }

            const createdUser = await fastify.userService.createUser(
                newUser,
                request.body.password,
                {
                    confirmAge: request.body.ageConfirmed === true
                }
            )
            request.log.info({ userId: createdUser.id }, 'Created user')
            await authSession({
                session: request.session,
                user: createdUser,
                proof: 'authentication-method',
                sessions: fastify.sessionService
            })
            return { status: 'ok', payload: { user: createdUser } }
        }
    )
}
