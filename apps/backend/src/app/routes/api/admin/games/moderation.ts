import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type GameParams = Static<typeof GameParams>
const GameParams = Type.Object({ gameId: Type.String() }, { additionalProperties: false })

type MessageParams = Static<typeof MessageParams>
const MessageParams = Type.Object(
    { gameId: Type.String(), messageId: Type.String() },
    { additionalProperties: false }
)

type RenameRequest = Static<typeof RenameRequest>
const RenameRequest = Type.Object(
    { name: Type.String({ minLength: 1, maxLength: 100 }) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    const onRequest = fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
        relation: 'and'
    })

    fastify.post<{ Params: MessageParams }>(
        '/:gameId/chat/:messageId/redact',
        { schema: { params: MessageParams }, onRequest },
        async function (request) {
            if (!request.user) throw Error('Removing a chat message requires an administrator')
            const { gameId, messageId } = request.params
            const message = await fastify.chatService.redactGameChatMessage(
                request.user,
                gameId,
                messageId
            )
            return { status: 'ok', payload: { message } }
        }
    )

    fastify.post<{ Params: GameParams; Body: RenameRequest }>(
        '/:gameId/rename',
        { schema: { params: GameParams, body: RenameRequest }, onRequest },
        async function (request) {
            if (!request.user) throw Error('Renaming a game requires an administrator')
            const game = await fastify.gameService.renameGameAsAdministrator({
                gameId: request.params.gameId,
                name: request.body.name,
                administrator: request.user
            })
            return { status: 'ok', payload: { game } }
        }
    )
}
