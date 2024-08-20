import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type CheckSyncRequest = Static<typeof CheckSyncRequest>
const CheckSyncRequest = Type.Object(
    {
        gameId: Type.String(),
        checksum: Type.Number(),
        index: Type.Number()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: CheckSyncRequest }>(
        '/checkSync',
        {
            schema: { body: CheckSyncRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            const checkResult = await fastify.gameService.checkSync(request.body)
            return { status: 'ok', payload: checkResult }
        }
    )
}
