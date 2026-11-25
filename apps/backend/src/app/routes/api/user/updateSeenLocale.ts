import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { LocaleTag } from '@tabletop/common'

type UserSeenLocaleUpdateRequest = Static<typeof UserSeenLocaleUpdateRequest>
const UserSeenLocaleUpdateRequest = Type.Object(
    { locale: LocaleTag },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UserSeenLocaleUpdateRequest }>(
        '/updateSeenLocale',
        {
            schema: { body: UserSeenLocaleUpdateRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (request.user === null || request.user === undefined) {
                throw Error('No user found for seen locale update')
            }

            const updatedUser = await fastify.userService.updateUserSeenLocale(
                request.user.id,
                request.body.locale
            )

            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
