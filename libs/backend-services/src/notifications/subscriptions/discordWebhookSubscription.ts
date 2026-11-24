import { type Static, Type } from 'typebox'
import { TransportType } from '../transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from './notificationSubscriptionIdentifier.js'

export type DiscordWebhookSubscription = Static<typeof DiscordWebhookSubscription>
export const DiscordWebhookSubscription = Type.Evaluate(
    Type.Intersect([
        Type.Omit(NotificationSubscriptionIdentifier, ['transport']),
        Type.Object({
            transport: Type.Literal(TransportType.DiscordWebhook),
            userId: Type.String(),
            webhookId: Type.String(),
            webhookToken: Type.String(),
            name: Type.String()
        })
    ])
)

// Naming the webhook keeps a late failure from a replaced webhook off its successor's subscription.
export function discordWebhookSubscriptionId(userId: string, webhookId: string): string {
    return `${userId}-${webhookId}`
}
