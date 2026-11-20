import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { seatHandoverAnnouncement } from '@tabletop/backend-services'

type GameParams = Static<typeof GameParams>
const GameParams = Type.Object({ gameId: Type.String() }, { additionalProperties: false })

type MessageParams = Static<typeof MessageParams>
const MessageParams = Type.Object(
    { gameId: Type.String(), messageId: Type.String() },
    { additionalProperties: false }
)

type PlayerParams = Static<typeof PlayerParams>
const PlayerParams = Type.Object(
    { gameId: Type.String(), playerId: Type.String() },
    { additionalProperties: false }
)

type SeatHandoverRequest = Static<typeof SeatHandoverRequest>
const SeatHandoverRequest = Type.Object(
    { username: Type.String({ minLength: 1, maxLength: 64 }) },
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

    fastify.post<{ Params: PlayerParams; Body: SeatHandoverRequest }>(
        '/:gameId/players/:playerId/handover',
        { schema: { params: PlayerParams, body: SeatHandoverRequest }, onRequest },
        async function (request) {
            if (!request.user) throw Error('Handing over a seat requires an administrator')
            const { gameId, playerId } = request.params
            const { game, formerHolder, newHolder } =
                await fastify.gameService.handOverSeatAsAdministrator({
                    gameId,
                    playerId,
                    username: request.body.username,
                    administrator: request.user
                })
            await fastify.chatService.announceAsAdministrator(
                request.user,
                gameId,
                seatHandoverAnnouncement(formerHolder, newHolder)
            )
            return { status: 'ok', payload: { game } }
        }
    )
}
