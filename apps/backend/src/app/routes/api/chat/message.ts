import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { addToChecksum, GameChatMessage } from '@tabletop/common'
import { Value } from 'typebox/value'

type MessageRequest = Static<typeof MessageRequest>
const MessageRequest = Type.Object(
    {
        gameId: Type.String(),
        message: GameChatMessage,
        checksum: Type.Number()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: MessageRequest }>(
        `/message`,
        {
            schema: {
                body: MessageRequest
            },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const user = request.user
            if (!user) {
                throw Error('No user found for create request')
            }

            const message = Value.Convert(GameChatMessage, request.body.message) as GameChatMessage
            message.userId = user.id

            // Trim message to 500 characters
            message.text = message.text.trim().slice(0, 500)

            if (!Value.Check(GameChatMessage, message)) {
                throw Error('Invalid message format')
            }

            const chat = await fastify.chatService.addGameChatMessage(
                user,
                message,
                request.body.gameId
            )
            const addedMessage = chat.messages.find((m) => m.id === message.id)
            const checksum = request.body.checksum
            // Find missed messages

            const newChecksum = addToChecksum(checksum, [message.id])
            let missedMessages: GameChatMessage[] = []
            if (newChecksum !== chat.checksum) {
                let calculatedChecksum = 0
                let lastKnownIndex = -1
                for (const [index, message] of chat.messages.entries()) {
                    calculatedChecksum = addToChecksum(calculatedChecksum, [message.id])
                    if (calculatedChecksum === checksum) {
                        lastKnownIndex = index
                        break
                    }
                }

                if (lastKnownIndex > 0) {
                    missedMessages = chat.messages.slice(
                        lastKnownIndex + 1,
                        chat.messages.length - 1
                    )
                }
            }

            return {
                status: 'ok',
                payload: { message: addedMessage, checksum: chat.checksum, missedMessages }
            }
        }
    )
}
