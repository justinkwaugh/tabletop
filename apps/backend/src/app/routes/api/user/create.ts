import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { Role, User, UserStatus } from '@tabletop/common'
import { randomUUID } from 'crypto'
import { authSession } from '../../../lib/session.js'

type UserCreateRequest = Static<typeof UserCreateRequest>
const UserCreateRequest = Type.Composite(
    [
        Type.Required(Type.Pick(User, ['username', 'email'])),
        Type.Object({
            password: Type.String()
        })
    ],
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UserCreateRequest }>(
        '/create',
        {
            schema: { body: UserCreateRequest }
        },
        async function (request, _reply) {
            if (request.user) {
                throw Error('User already has valid session')
            }

            const newUser = {
                id: randomUUID(),
                username: request.body.username.trim(),
                status: UserStatus.Incomplete,
                externalIds: [],
                email: request.body.email.trim(),
                emailVerified: false,
                roles: [Role.User]
            }

            const createdUser = await fastify.userService.createUser(newUser, request.body.password)
            console.log(`Created user ${JSON.stringify(createdUser)}`)
            authSession({ session: request.session, userId: createdUser.id })
            return { status: 'ok', payload: { user: createdUser } }
        }
    )
}
