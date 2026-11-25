import { describe, expect, it, vi } from 'vitest'
import { UserService } from '../../users/userService.js'
import {
    NotificationCategory,
    UserNotificationAction,
    UserStatus,
    type User,
    type UserNotification
} from '@tabletop/common'
import type { DiscordWebhookDelivery } from '../../discord/discordWebhookApi.js'
import type { DiscordWebhookSubscription } from '../subscriptions/discordWebhookSubscription.js'
import { DiscordWebhookTransport } from './discordWebhookTransport.js'
import { TransportType } from './notificationTransport.js'

const turn: UserNotification = {
    id: 'n-1',
    type: NotificationCategory.User,
    action: UserNotificationAction.IsYourTurn,
    data: { user: { id: 'u-1' }, game: { id: 'game-1', typeId: '1846', name: 'Friday night' } }
}

const subscription: DiscordWebhookSubscription = {
    id: 'u-1-7',
    transport: TransportType.DiscordWebhook,
    userId: 'u-1',
    webhookId: '7',
    webhookToken: 'secret',
    name: 'Game night'
}

function transportAnswering(delivery: DiscordWebhookDelivery, externalIds: string[] = []) {
    const user: User = {
        id: 'u-1',
        username: 'ann',
        status: UserStatus.Active,
        roles: [],
        externalIds
    }
    const execute = vi.fn(async () => delivery)
    const transport = new DiscordWebhookTransport(
        {
            library: {
                getServedManifest: async () => ({ frontend: { version: '1.0.0' }, games: [] })
            },
            catalog: { getCatalog: async () => [] }
        },
        { execute },
        {
            getUser: async (id: string) => (id === user.id ? user : undefined),
            extractExternalId: UserService.prototype.extractExternalId
        },
        'https://example.com'
    )
    return { transport, execute }
}

describe('DiscordWebhookTransport', () => {
    it('posts to the webhook and mentions the linked Discord account', async () => {
        const { transport, execute } = transportAnswering({ ok: true }, ['discord:99'])

        expect(await transport.sendNotification(subscription, turn, 'en')).toEqual({
            success: true,
            unregister: false
        })
        expect(execute).toHaveBeenCalledWith(
            { id: '7', token: 'secret' },
            expect.objectContaining({ allowed_mentions: { parse: [], users: ['99'] } })
        )
    })

    it('drops a webhook Discord no longer has', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { transport } = transportAnswering({ ok: false, status: 404, gone: true })

        expect(await transport.sendNotification(subscription, turn, 'en')).toEqual({
            success: false,
            unregister: true
        })
    })

    it('keeps a webhook through rate limits', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { transport } = transportAnswering({ ok: false, status: 429, gone: false })

        expect(await transport.sendNotification(subscription, turn, 'en')).toEqual({
            success: false,
            unregister: false
        })
    })
})
