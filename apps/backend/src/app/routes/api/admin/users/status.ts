import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ACCOUNT_STATUS_TRANSITIONS, UserStatus } from '@tabletop/common'

type AccountStatusParams = Static<typeof AccountStatusParams>
const AccountStatusParams = Type.Object({ userId: Type.String() }, { additionalProperties: false })

type AccountStatusRequest = Static<typeof AccountStatusRequest>
const AccountStatusRequest = Type.Object(
    {
        transition: Type.Union(
            ACCOUNT_STATUS_TRANSITIONS.map((transition) => Type.Literal(transition))
        )
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Params: AccountStatusParams; Body: AccountStatusRequest }>(
        '/:userId/status',
        {
            schema: { params: AccountStatusParams, body: AccountStatusRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyAdminMode], {
                relation: 'and'
            })
        },
        async function (request) {
            const { userId } = request.params
            const user = await fastify.userService.transitionAccountStatus(
                userId,
                request.body.transition
            )
            if (user.status === UserStatus.Inactive) {
                await fastify.realtimeControl.revokeAccount(userId)
            }
            return { status: 'ok', payload: { user } }
        }
    )
}
