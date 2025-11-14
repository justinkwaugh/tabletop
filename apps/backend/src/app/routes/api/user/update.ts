import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { User } from '@tabletop/common'

type UserUpdateRequest = Static<typeof UserUpdateRequest>
const UserUpdateRequest = Type.Evaluate(
    Type.Intersect(
        [
            Type.Pick(User, ['username', 'email']),
            Type.Object({
                password: Type.Optional(Type.String()),
                currentPassword: Type.Optional(Type.String()),
                token: Type.Optional(Type.String())
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
            if (request.user === null || request.user === undefined) {
                throw Error('No user found for create request')
            }

            let { username, email, password, currentPassword, token } = request.body
            username = username?.trim()
            email = email?.trim()
            password = password?.trim()
            currentPassword = currentPassword?.trim()
            token = token?.trim()

            const updates = {
                username,
                email
            }

            const updatedUser = await fastify.userService.updateUser(
                request.user.id,
                updates,
                password,
                currentPassword,
                token
            )
            console.log(`Updated user ${JSON.stringify(updatedUser)}`)
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
