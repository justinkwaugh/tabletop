import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type UnlinkExternalAccountRequest = Static<typeof UnlinkExternalAccountRequest>
const UnlinkExternalAccountRequest = Type.Object(
    {
        externalId: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UnlinkExternalAccountRequest }>(
        '/unlinkExternalAccount',
        {
            schema: { body: UnlinkExternalAccountRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { externalId } = request.body
            const updatedUser = await fastify.userService.unlinkExternalAccount({
                userId: request.user.id,
                externalId
            })
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
