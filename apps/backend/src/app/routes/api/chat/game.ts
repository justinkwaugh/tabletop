import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    gameId: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>(
        '/game/:gameId',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            const { gameId } = request.params
            const etagData = await fastify.chatService.getGameChatEtag(gameId)
            const etag = etagData ? `W/"${etagData}"` : undefined
            const ifNoneMatch = request.headers['if-none-match']
            if (ifNoneMatch === etag) {
                await reply.code(304).send()
                return
            }

            const chat = await fastify.chatService.getGameChat(gameId)

            if (!chat) {
                console.log('Chat not found')
                await reply.code(404).send()
                return
            }

            void reply.header('ETag', etag)

            return { status: 'ok', payload: { chat } }
        }
    )
}
