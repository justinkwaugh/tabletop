import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { assertExists, User } from '@tabletop/common'
import { authSession } from '../../../lib/session.js'

type UserUpdateRequest = Static<typeof UserUpdateRequest>
const UserUpdateRequest = Type.Evaluate(
    Type.Intersect(
        [
            Type.Pick(User, ['username', 'email']),
            Type.Object({
                password: Type.Optional(Type.String())
            })
        ],
        { additionalProperties: false }
    )
)
export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UserUpdateRequest }>(
        '/update',
        {
            schema: { body: UserUpdateRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            const session = request.authenticatedSession
            assertExists(session, 'Profile updates require an authorized session')
            let { username, email, password } = request.body
            username = username?.trim()
            email = email?.trim()
            password = password?.trim()

            const updates = {
                username,
                email
            }

            const updatedUser = await fastify.userService.updateUser(session, updates, password)
            if (password) {
                await authSession({
                    session: request.session,
                    user: updatedUser,
                    proof: { authenticatedAt: session.authenticatedAt },
                    sessions: fastify.sessionService
                })
            }
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
