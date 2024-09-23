import { FastifyInstance } from 'fastify'
import { Kind, Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

type BookmarkPostRequest = Static<typeof BookmarkPostRequest>
const BookmarkPostRequest = Type.Object(
    {
        gameId: Type.String(),
        lastReadTimestamp: Type.Unsafe<Date>({ [Kind]: 'Date', format: 'date-time' })
    },
    { additionalProperties: false }
)

type GetParamsType = Static<typeof GetParamsType>
const GetParamsType = Type.Object({
    gameId: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: GetParamsType }>(
        '/bookmark/:gameId',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const user = request.user
            if (!user) {
                throw Error('No user found for request')
            }

            const { gameId } = request.params
            const bookmark = await fastify.chatService.getGameChatBookmark(user, gameId)

            return { status: 'ok', payload: { bookmark } }
        }
    )

    fastify.post<{ Body: BookmarkPostRequest }>(
        `/bookmark`,
        {
            schema: {
                body: BookmarkPostRequest
            },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const user = request.user
            if (!user) {
                throw Error('No user found for request')
            }

            const { gameId, lastReadTimestamp } = Value.Convert(
                BookmarkPostRequest,
                request.body
            ) as BookmarkPostRequest
            await fastify.chatService.setGameChatBookmark(user, gameId, lastReadTimestamp)

            return {
                status: 'ok'
            }
        }
    )
}
