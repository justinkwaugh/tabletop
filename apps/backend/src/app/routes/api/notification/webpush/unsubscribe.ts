import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { WebPushTransport } from '@tabletop/backend-services'

type UnsubscribeWebPush = Static<typeof UnsubscribeWebPush>
const UnsubscribeWebPush = Type.Object(
    {
        endpoint: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UnsubscribeWebPush }>(
        '/unsubscribe',
        {
            schema: { body: UnsubscribeWebPush }
        },
        async function (request, _reply) {
            const { endpoint } = request.body
            const identifier = WebPushTransport.webPushSubscriptionIdentifierFromEndpoint(endpoint)
            await fastify.notificationService.unregisterNotificationSubscription(identifier)
            return { status: 'ok', payload: {} }
        }
    )
}
