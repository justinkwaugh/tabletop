import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type AccountParams = Static<typeof AccountParams>
const AccountParams = Type.Object({ userId: Type.String() }, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    const onRequest = fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
        relation: 'and'
    })

    fastify.get<{ Params: AccountParams }>(
        '/:userId/notifications',
        { schema: { params: AccountParams }, onRequest },
        async function (request) {
            const registrations = await fastify.topicRegistrationsService.forAdministrator(
                request.params.userId
            )
            return { status: 'ok', payload: { registrations } }
        }
    )

    fastify.get<{ Params: AccountParams }>(
        '/:userId/games',
        { schema: { params: AccountParams }, onRequest },
        async function (request, reply) {
            const user = await fastify.userService.getUser(request.params.userId)
            if (!user) return reply.code(404).send()
            const [active, completed] = await Promise.all([
                fastify.gameService.getActiveGamesForUser(user),
                fastify.gameService.getCompletedGamesForUser(user)
            ])
            return { status: 'ok', payload: { games: active.concat(completed) } }
        }
    )
}
