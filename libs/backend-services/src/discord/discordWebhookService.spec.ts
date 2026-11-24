import { describe, expect, it, vi } from 'vitest'
import { UserService } from '../users/userService.js'
import {
    DiscordWebhookConnectResult,
    SystemNotificationAction,
    UserStatus,
    type User
} from '@tabletop/common'
import type { NotificationSubscription } from '../notifications/subscriptions/notificationSubscription.js'
import type { NotificationSubscriptionIdentifier } from '../notifications/subscriptions/notificationSubscriptionIdentifier.js'
import type { DiscordWebhookDelivery, DiscordWebhookLookup } from './discordWebhookApi.js'
import { DiscordWebhookService } from './discordWebhookService.js'

const URL_1 = 'https://discord.com/api/webhooks/111/token-a'

function createService({
    lookup = { kind: 'found', name: 'Game night' },
    delivery = { ok: true },
    externalIds = []
}: {
    lookup?: DiscordWebhookLookup
    delivery?: DiscordWebhookDelivery
    externalIds?: string[]
} = {}) {
    const user: User = {
        id: 'user-1',
        username: 'ann',
        status: UserStatus.Active,
        roles: [],
        externalIds
    }
    const registrations = new Map<
        string,
        { subscription: NotificationSubscription; topics: string[] }
    >()
    const keyOf = ({ transport, id }: NotificationSubscriptionIdentifier) => `${transport}:${id}`
    const notifications = {
        registerNotificationSubscription: vi.fn(
            async ({
                subscription,
                topic
            }: {
                subscription: NotificationSubscription
                topic: string
            }) => {
                const existing = registrations.get(keyOf(subscription))
                registrations.set(keyOf(subscription), {
                    subscription: existing?.subscription ?? subscription,
                    topics: [...(existing?.topics ?? []), topic]
                })
            }
        ),
        unregisterNotificationSubscription: vi.fn(
            async (identifier: NotificationSubscriptionIdentifier) => {
                registrations.delete(keyOf(identifier))
            }
        ),
        sendNotification: vi.fn(async () => {})
    }
    const webhooks = {
        lookup: vi.fn(async () => lookup),
        execute: vi.fn(async () => delivery)
    }
    const service = new DiscordWebhookService(
        {
            notifications,
            subscriptions: {
                findNotificationSubscriptions: async (topic: string) =>
                    [...registrations.values()]
                        .filter((registration) => registration.topics.includes(topic))
                        .map((registration) => registration.subscription)
            },
            users: {
                getUser: async (id: string) => (id === user.id ? user : undefined),
                extractExternalId: UserService.prototype.extractExternalId
            },
            webhooks
        },
        'https://example.com'
    )
    const webhookName = () =>
        [...registrations.values()].find(({ topics }) => topics.includes('user-user-1'))
            ?.subscription
    return {
        service,
        notifications,
        webhooks,
        registrations,
        connectedName: () => {
            const subscription = webhookName()
            return subscription && 'name' in subscription ? subscription.name : undefined
        }
    }
}

describe('DiscordWebhookService', () => {
    it('posts a welcome, then shows the webhook by its Discord name', async () => {
        const { service, webhooks, notifications, connectedName } = createService({
            externalIds: ['discord:99']
        })

        expect(await service.connect('user-1', URL_1)).toBe(DiscordWebhookConnectResult.Connected)
        expect(connectedName()).toBe('Game night')
        expect(webhooks.execute).toHaveBeenCalledWith(
            { id: '111', token: 'token-a' },
            expect.objectContaining({
                content: '<@99> BoardTogether will post notifications for ann here.',
                allowed_mentions: { parse: [], users: ['99'] }
            })
        )
        expect(notifications.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                notification: expect.objectContaining({
                    action: SystemNotificationAction.TopicRegistrationsChanged
                }),
                topics: ['user-user-1']
            })
        )
    })

    it('refuses an address that is not a Discord webhook without calling Discord', async () => {
        const { service, webhooks } = createService()

        expect(await service.connect('user-1', 'https://example.com/hook')).toBe(
            DiscordWebhookConnectResult.InvalidUrl
        )
        expect(webhooks.lookup).not.toHaveBeenCalled()
    })

    it('reports a webhook Discord does not have', async () => {
        const { service, connectedName } = createService({ lookup: { kind: 'gone' } })

        expect(await service.connect('user-1', URL_1)).toBe(DiscordWebhookConnectResult.NotFound)
        expect(connectedName()).toBeUndefined()
    })

    it('refuses a webhook that only Discord apps can post to', async () => {
        const { service, webhooks } = createService({ lookup: { kind: 'unsupported' } })

        expect(await service.connect('user-1', URL_1)).toBe(DiscordWebhookConnectResult.Unsupported)
        expect(webhooks.execute).not.toHaveBeenCalled()
    })

    it('keeps the current webhook when the new one refuses the welcome', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { service, webhooks, connectedName } = createService()
        await service.connect('user-1', URL_1)
        webhooks.execute.mockResolvedValueOnce({ ok: false, status: 403, gone: false })

        expect(
            await service.connect('user-1', 'https://discord.com/api/webhooks/222/token-b')
        ).toBe(DiscordWebhookConnectResult.Failed)
        expect(connectedName()).toBe('Game night')
    })

    it('replaces the webhook when the player connects another', async () => {
        const { service, registrations } = createService()

        await service.connect('user-1', URL_1)
        await service.connect('user-1', 'https://discord.com/api/webhooks/222/token-b')

        expect([...registrations.values()].map(({ subscription }) => subscription)).toEqual([
            expect.objectContaining({ webhookId: '222', webhookToken: 'token-b' })
        ])
    })

    it('keeps a newly connected webhook when the replaced one fails late', async () => {
        const { service, notifications, connectedName } = createService()
        await service.connect('user-1', URL_1)
        const replaced =
            notifications.registerNotificationSubscription.mock.calls[0][0].subscription
        await service.connect('user-1', 'https://discord.com/api/webhooks/222/token-b')

        await notifications.unregisterNotificationSubscription(replaced)

        expect(connectedName()).toBe('Game night')
    })

    it('disconnects only the player’s own webhook', async () => {
        const { service, connectedName } = createService()
        await service.connect('user-1', URL_1)

        await service.disconnect('user-2')
        expect(connectedName()).toBe('Game night')

        await service.disconnect('user-1')
        expect(connectedName()).toBeUndefined()
    })
})
