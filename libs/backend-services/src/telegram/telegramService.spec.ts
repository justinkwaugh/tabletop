import { describe, expect, it, vi } from 'vitest'
import { SystemNotificationAction, UserStatus, type User } from '@tabletop/common'
import { NotificationDistributionMethod } from '../notifications/notificationService.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import type { NotificationSubscription } from '../notifications/subscriptions/notificationSubscription.js'
import type { NotificationSubscriptionIdentifier } from '../notifications/subscriptions/notificationSubscriptionIdentifier.js'
import type { TelegramSendMessage } from './telegramBotApi.js'
import { TelegramService } from './telegramService.js'

const activeUser: User = {
    id: 'user-1',
    username: 'ann',
    status: UserStatus.Active,
    roles: [],
    externalIds: []
}

function privateMessage(text: string, chatId = 42) {
    return { update_id: 1, message: { chat: { id: chatId, type: 'private' }, text } }
}

function blockedBy(chatId: number) {
    return {
        update_id: 2,
        my_chat_member: {
            chat: { id: chatId, type: 'private' },
            new_chat_member: { status: 'kicked' }
        }
    }
}

function createService({ user = activeUser, configured = true } = {}) {
    const linkTokens = new Map<string, string>()
    const registrations = new Map<
        string,
        { subscription: NotificationSubscription; topics: string[] }
    >()
    const sent: TelegramSendMessage[] = []
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
                    subscription,
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

    const service = new TelegramService(
        {
            notifications,
            subscriptions: {
                findNotificationSubscriptions: async (topic: string) =>
                    [...registrations.values()]
                        .filter((registration) => registration.topics.includes(topic))
                        .map((registration) => registration.subscription),
                findSubscriptionTopics: async (identifier: NotificationSubscriptionIdentifier) =>
                    registrations.get(keyOf(identifier))?.topics ?? []
            },
            users: { getUser: async (id: string) => (user.id === id ? user : undefined) },
            linkTokens: {
                get: async (key: string) => ({ value: linkTokens.get(key) }),
                set: async (key: string, value: string) => void linkTokens.set(key, value),
                delete: async (key: string) => void linkTokens.delete(key)
            }
        },
        configured
            ? {
                  api: {
                      sendMessage: async (message: TelegramSendMessage) => {
                          sent.push(message)
                          return { ok: true, result: {} }
                      },
                      botUsername: async () => 'BoardTogetherBot'
                  },
                  webhookSecret: 'webhook-secret'
              }
            : undefined,
        'https://example.com'
    )
    return { service, notifications, sent }
}

function startToken(url: string): string {
    const token = new URL(url).searchParams.get('start')
    if (!token) throw new Error(`No start token in ${url}`)
    return token
}

async function connect(service: TelegramService, chatId = 42) {
    await service.handleUpdate(
        privateMessage(`/start ${startToken(await service.connectLink('user-1'))}`, chatId)
    )
}

const registrationsChangedFor = (topic: string) => ({
    notification: expect.objectContaining({
        action: SystemNotificationAction.TopicRegistrationsChanged
    }),
    topics: [topic],
    channels: [NotificationDistributionMethod.Topical]
})

describe('TelegramService', () => {
    it('is unavailable without a bot', () => {
        const { service } = createService({ configured: false })
        expect(service.isAvailable).toBe(false)
        expect(service.isWebhookSecret('anything')).toBe(false)
    })

    it('accepts only the configured webhook secret', () => {
        const { service } = createService()
        expect(service.isWebhookSecret('webhook-secret')).toBe(true)
        expect(service.isWebhookSecret('webhook-secreT')).toBe(false)
        expect(service.isWebhookSecret(undefined)).toBe(false)
    })

    it('connects the chat that starts the bot with a link token', async () => {
        const { service, notifications, sent } = createService()

        const url = await service.connectLink('user-1')
        expect(url).toMatch(/^https:\/\/t\.me\/BoardTogetherBot\?start=[\w-]{32}$/)
        await service.handleUpdate(privateMessage(`/start ${startToken(url)}`))

        expect(await service.isConnected('user-1')).toBe(true)
        expect(notifications.registerNotificationSubscription).toHaveBeenCalledWith({
            subscription: { id: '42', transport: TransportType.Telegram, chatId: '42' },
            topic: 'user-user-1'
        })
        expect(notifications.sendNotification).toHaveBeenCalledWith(
            registrationsChangedFor('user-user-1')
        )
        expect(sent.at(-1)?.text).toContain("You're connected as ann")
    })

    it('uses a link token only once', async () => {
        const { service, notifications, sent } = createService()
        const token = startToken(await service.connectLink('user-1'))

        await service.handleUpdate(privateMessage(`/start ${token}`))
        await service.handleUpdate(privateMessage(`/start ${token}`, 7))

        expect(notifications.registerNotificationSubscription).toHaveBeenCalledTimes(1)
        expect(sent.at(-1)).toMatchObject({ chat_id: '7' })
        expect(sent.at(-1)?.text).toContain("isn't connected")
    })

    it('explains how to connect when started without a token', async () => {
        const { service, notifications, sent } = createService()

        await service.handleUpdate(privateMessage('/start'))

        expect(notifications.registerNotificationSubscription).not.toHaveBeenCalled()
        expect(sent.at(-1)?.text).toContain('https://example.com/notifications')
    })

    it('does not connect an account that can no longer sign in', async () => {
        const { service, notifications } = createService({
            user: { ...activeUser, status: UserStatus.Deleted }
        })

        await connect(service)

        expect(notifications.registerNotificationSubscription).not.toHaveBeenCalled()
    })

    it('ignores group chats', async () => {
        const { service, notifications, sent } = createService()
        const token = startToken(await service.connectLink('user-1'))

        await service.handleUpdate({
            update_id: 1,
            message: { chat: { id: -100, type: 'group' }, text: `/start ${token}` }
        })

        expect(notifications.registerNotificationSubscription).not.toHaveBeenCalled()
        expect(sent).toEqual([])
    })

    it('stops on /stop and tells an open Notifications page', async () => {
        const { service, notifications } = createService()
        await connect(service)
        notifications.sendNotification.mockClear()

        await service.handleUpdate(privateMessage('/stop'))

        expect(await service.isConnected('user-1')).toBe(false)
        expect(notifications.sendNotification).toHaveBeenCalledWith(
            registrationsChangedFor('user-user-1')
        )
    })

    it('stops when the user blocks the bot and tells an open Notifications page', async () => {
        const { service, notifications } = createService()
        await connect(service)
        notifications.sendNotification.mockClear()

        await service.handleUpdate(blockedBy(42))

        expect(await service.isConnected('user-1')).toBe(false)
        expect(notifications.sendNotification).toHaveBeenCalledWith(
            registrationsChangedFor('user-user-1')
        )
    })

    it('announces nothing when an unconnected chat sends /stop', async () => {
        const { service, notifications } = createService()

        await service.handleUpdate(privateMessage('/stop'))

        expect(notifications.unregisterNotificationSubscription).not.toHaveBeenCalled()
        expect(notifications.sendNotification).not.toHaveBeenCalled()
    })

    it('disconnects every chat a user connected from the site', async () => {
        const { service } = createService()
        await connect(service, 1)
        await connect(service, 2)

        await service.disconnect('user-1')

        expect(await service.isConnected('user-1')).toBe(false)
    })

    it('replies in the language Telegram reports for the sender', async () => {
        const { service, sent } = createService()

        await service.handleUpdate({
            update_id: 4,
            message: {
                chat: { id: 42, type: 'private' },
                from: { language_code: 'de' },
                text: 'hallo'
            }
        })

        expect(sent.at(-1)?.text).toBe(
            'Ich verschicke nur Benachrichtigungen von BoardTogether. Schick /stop, um sie abzuschalten, oder verwalte sie auf https://example.com/notifications.'
        )
    })

    it("replies in the connected account's language when Telegram reports none", async () => {
        const { service, sent } = createService({ user: { ...activeUser, seenLocale: 'de' } })
        await connect(service)

        await service.handleUpdate(privateMessage('hallo'))

        expect(sent.at(-1)?.text).toContain('Ich verschicke nur Benachrichtigungen')
    })

    it('ignores updates it does not understand', async () => {
        const { service, sent } = createService()
        await service.handleUpdate({ nonsense: true })
        await service.handleUpdate({ update_id: 3, edited_message: {} })
        expect(sent).toEqual([])
    })
})
