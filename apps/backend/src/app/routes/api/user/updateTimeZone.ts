import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type UserTimeZoneUpdateRequest = Static<typeof UserTimeZoneUpdateRequest>
const UserTimeZoneUpdateRequest = Type.Object(
    {
        timeZone: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UserTimeZoneUpdateRequest }>(
        '/updateTimeZone',
        {
            schema: { body: UserTimeZoneUpdateRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (request.user === null || request.user === undefined) {
                throw Error('No user found for time zone update')
            }

            const updatedUser = await fastify.userService.updateUserTimeZone(
                request.user.id,
                request.body.timeZone
            )

            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
