import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { UserPreferences } from '@tabletop/common'

type UserPreferencesUpdateRequest = Static<typeof UserPreferencesUpdateRequest>
const UserPreferencesUpdateRequest = Type.Object(
    {
        preferences: UserPreferences
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UserPreferencesUpdateRequest }>(
        '/updatePreferences',
        {
            schema: { body: UserPreferencesUpdateRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (request.user === null || request.user === undefined) {
                throw Error('No user found for create request')
            }

            const { preferences } = request.body
            const updatedUser = await fastify.userService.updateUserPreferences(
                request.user.id,
                preferences
            )

            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
