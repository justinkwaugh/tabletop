import { describe, expect, it } from 'vitest'
import type { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import { TopicRegistrationsService } from './topicRegistrationsService.js'
import { TransportType } from './transports/notificationTransport.js'

const registered: NotificationSubscription[] = [
    { id: 'd-1', transport: TransportType.Discord, discordUserId: 'd-1' },
    {
        id: 'user-1',
        transport: TransportType.DiscordWebhook,
        userId: 'user-1',
        webhookId: '7',
        webhookToken: 'secret',
        name: 'game-night'
    },
    {
        id: 'push-1',
        transport: TransportType.WebPush,
        endpoint: 'https://fcm.googleapis.com/fcm/send/token-1',
        keys: { p256dh: 'p256dh', auth: 'auth' }
    },
    {
        id: 'push-2',
        transport: TransportType.WebPush,
        endpoint: 'https://web.push.apple.com/token-2',
        keys: { p256dh: 'p256dh', auth: 'auth' }
    }
]

function serviceFor(bots: { discordBot: boolean; telegram: boolean }) {
    return new TopicRegistrationsService(
        {
            findNotificationSubscriptions: async (topic: string) =>
                topic === 'user-user-1' ? registered : []
        },
        bots
    )
}

describe('TopicRegistrationsService', () => {
    it('summarizes every registration on the player’s topic without the webhook token', async () => {
        expect(await serviceFor({ discordBot: true, telegram: true }).forUser('user-1')).toEqual({
            discordBot: { available: true, connected: true },
            telegram: { available: true, connected: false },
            discordWebhook: { name: 'game-night' }
        })
    })

    it('reports a bot the backend does not run as unavailable and unconnected', async () => {
        const registrations = await serviceFor({ discordBot: false, telegram: false }).forUser(
            'user-1'
        )

        expect(registrations.discordBot).toEqual({ available: false, connected: false })
        expect(registrations.telegram).toEqual({ available: false, connected: false })
    })

    it('reports nothing for a player with no registrations', async () => {
        expect(await serviceFor({ discordBot: true, telegram: true }).forUser('user-2')).toEqual({
            discordBot: { available: true, connected: false },
            telegram: { available: true, connected: false },
            discordWebhook: undefined
        })
    })

    it('names for an administrator each browser holding a push subscription and every connected channel', async () => {
        expect(
            await serviceFor({ discordBot: true, telegram: true }).forAdministrator('user-1')
        ).toEqual({
            webPushBrowsers: ['Chrome', 'Safari'],
            discordBot: true,
            telegram: false,
            discordWebhook: { name: 'game-night' }
        })
    })

    it('reports to an administrator a bot channel as off while the backend does not run that bot', async () => {
        const registrations = await serviceFor({
            discordBot: false,
            telegram: false
        }).forAdministrator('user-1')

        expect(registrations.discordBot).toBe(false)
    })
})
