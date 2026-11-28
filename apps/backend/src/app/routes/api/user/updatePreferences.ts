import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { sharesTimeDifference, UserPreferences } from '@tabletop/common'

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
            if (
                sharesTimeDifference(request.user.preferences) !==
                sharesTimeDifference(updatedUser.preferences)
            ) {
                await fastify.lobbyPosts?.queueHostedGames(updatedUser)
            }

            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
