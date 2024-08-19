import {
    NotificationListener,
    SSEAuthorizationTokenData,
    TokenType
} from '@tabletop/backend-services'
import { FastifyInstance } from 'fastify'
import { Type, Static } from '@sinclair/typebox'
import { nanoid } from 'nanoid'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    gameId: Type.String(),
    token: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>('/game/:gameId/:token', async function (request, reply) {
        const { gameId, token } = request.params

        const tokenData = await fastify.tokenService.getData<SSEAuthorizationTokenData>({
            token,
            expectedType: TokenType.SSEAuthorization
        })

        // Turn off for a bit
        await reply.code(401).send()
        return

        // if (!tokenData) {
        //     await reply.code(401).send()
        //     return
        // }

        // const user = await fastify.userService.getUser(tokenData.userId)
        // if (!user || user.status !== 'active') {
        //     await reply.code(401).send()
        //     return
        // }

        // let counter = 0

        // reply.sse({ id: String(counter++), data: 'hello' })

        // const listener: NotificationListener = {
        //     id: nanoid(),
        //     onMessage: async ({ message }) => {
        //         try {
        //             reply.sse({ id: String(counter++), data: message })
        //         } catch (e) {
        //             console.log('Error sending game SSE', e)
        //         }
        //     }
        // }

        // await fastify.notificationService.addTopicListener({
        //     listener,
        //     topic: `game-${gameId}`
        // })

        // request.raw.on('close', async () => {
        //     await fastify.notificationService.removeTopicListener({ listenerId: listener.id })
        // })

        // await fastify.tokenService.invalidateToken(token)
    })
}
