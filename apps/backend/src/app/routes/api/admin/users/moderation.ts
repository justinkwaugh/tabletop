import { assertExists } from '@tabletop/common'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type AccountParams = Static<typeof AccountParams>
const AccountParams = Type.Object({ userId: Type.String() }, { additionalProperties: false })

type RenameRequest = Static<typeof RenameRequest>
const RenameRequest = Type.Object({ username: Type.String() }, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    const onRequest = fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
        relation: 'and'
    })

    fastify.post<{ Params: AccountParams; Body: RenameRequest }>(
        '/:userId/username',
        { schema: { params: AccountParams, body: RenameRequest }, onRequest },
        async function (request) {
            const { userId } = request.params
            const user = await fastify.accountModeration.rename(userId, request.body.username)
            request.log.info({ adminId: request.user?.id, userId }, 'Administrator renamed account')
            return { status: 'ok', payload: { user } }
        }
    )

    fastify.post<{ Params: AccountParams }>(
        '/:userId/ban',
        { schema: { params: AccountParams }, onRequest },
        async function (request) {
            assertExists(request.user, 'Banning an account requires an administrator')
            const { userId } = request.params
            const user = await fastify.accountModeration.ban(userId, request.user.id)
            request.log.info({ adminId: request.user.id, userId }, 'Administrator banned account')
            return { status: 'ok', payload: { user } }
        }
    )

    fastify.post<{ Params: AccountParams }>(
        '/:userId/delete',
        { schema: { params: AccountParams }, onRequest },
        async function (request) {
            assertExists(request.user, 'Deleting an account requires an administrator')
            const { userId } = request.params
            const user = await fastify.accountModeration.deleteAccount(userId, request.user.id)
            request.log.info({ adminId: request.user.id, userId }, 'Administrator deleted account')
            return { status: 'ok', payload: { user } }
        }
    )

    fastify.post<{ Params: AccountParams }>(
        '/:userId/unban',
        { schema: { params: AccountParams }, onRequest },
        async function (request) {
            const { userId } = request.params
            const user = await fastify.accountModeration.unban(userId)
            request.log.info(
                { adminId: request.user?.id, userId },
                'Administrator lifted account ban'
            )
            return { status: 'ok', payload: { user } }
        }
    )
}
