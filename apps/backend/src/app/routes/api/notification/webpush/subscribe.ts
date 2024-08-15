import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { WebPushSubscriptionClientData, WebPushTransport } from '@tabletop/backend-services'

type SubscribeWebPush = Static<typeof SubscribeWebPush>
const SubscribeWebPush = Type.Object(
    {
        subscription: WebPushSubscriptionClientData
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SubscribeWebPush }>(
        '/subscribe',
        {
            schema: { body: SubscribeWebPush },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { subscription } = request.body
            const webPushSubscription =
                WebPushTransport.webPushSubscriptionFromClientData(subscription)

            await fastify.notificationService.registerNotificationSubscription({
                topic: `user-${request.user.id}`,
                subscription: webPushSubscription
            })

            return { status: 'ok', payload: {} }
        }
    )
}
