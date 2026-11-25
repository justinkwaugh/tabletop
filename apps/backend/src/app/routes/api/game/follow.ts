import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type FollowGameRequest = Static<typeof FollowGameRequest>
const FollowGameRequest = Type.Object(
    { gameId: Type.String({ minLength: 1 }) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    const onRequest = fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
        relation: 'and'
    })

    fastify.post<{ Body: FollowGameRequest }>(
        '/follow',
        { schema: { body: FollowGameRequest }, onRequest },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for follow request')
            }
            await fastify.gameFollowService.followGame(request.user, request.body.gameId)
            return { status: 'ok' }
        }
    )

    fastify.post<{ Body: FollowGameRequest }>(
        '/unfollow',
        { schema: { body: FollowGameRequest }, onRequest },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for unfollow request')
            }
            await fastify.gameFollowService.unfollowGame(request.user, request.body.gameId)
            return { status: 'ok' }
        }
    )
}
