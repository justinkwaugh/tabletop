import { describe, expect, it, vi } from 'vitest'
import { SystemNotificationAction, UserStatus, type User } from '@tabletop/common'
import { NotificationDistributionMethod } from '../notifications/notificationService.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import type { NotificationSubscription } from '../notifications/subscriptions/notificationSubscription.js'
import type { TelegramBotApi, TelegramSendMessage } from './telegramBotApi.js'
import { TelegramService } from './telegramService.js'

const activeUser = { id: 'user-1', username: 'ann', status: UserStatus.Active } as User

function privateMessage(text: string, chatId = 42) {
    return { update_id: 1, message: { chat: { id: chatId, type: 'private' }, text } }
}

function createService({ user = activeUser as User | undefined, configured = true } = {}) {
    const cached = new Map<string, unknown>()
    const subscriptionsByTopic = new Map<string, NotificationSubscription[]>()
    const sent: TelegramSendMessage[] = []

    const notifications = {
        registerNotificationSubscription: vi.fn(
            async ({
                subscription,
                topic
            }: {
                subscription: NotificationSubscription
                topic: string
            }) => {
                subscriptionsByTopic.set(topic, [
                    ...(subscriptionsByTopic.get(topic) ?? []),
                    subscription
                ])
            }
        ),
        unregisterNotificationSubscription: vi.fn(
            async ({ id, transport }: { id: string; transport: string }) => {
                for (const [topic, subscriptions] of subscriptionsByTopic) {
                    subscriptionsByTopic.set(
                        topic,
                        subscriptions.filter((s) => !(s.id === id && s.transport === transport))
                    )
                }
            }
        ),
        sendNotification: vi.fn(async () => {})
    }
    const api = {
        sendMessage: vi.fn(async (message: TelegramSendMessage) => {
            sent.push(message)
            return { ok: true as const, result: {} }
        }),
        botUsername: vi.fn(async () => 'BoardTogetherBot')
    } as unknown as TelegramBotApi

    const service = new TelegramService(
        {
            notifications,
            subscriptions: {
                findNotificationSubscriptions: async (topic: string) =>
                    subscriptionsByTopic.get(topic) ?? []
            },
            users: { getUser: async (id: string) => (user?.id === id ? user : undefined) },
            cache: {
                get: async <T>(key: string) => ({
                    value: cached.get(key) as T | undefined,
                    cached: cached.has(key)
                }),
                set: async (key: string, value: unknown) => void cached.set(key, value),
                delete: async (key: string) => void cached.delete(key)
            }
        },
        configured ? { api, webhookSecret: 'webhook-secret' } : undefined
    )
    return { service, notifications, sent }
}

function startToken(url: string): string {
    return new URL(url).searchParams.get('start')!
}

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
            expect.objectContaining({
                notification: expect.objectContaining({
                    action: SystemNotificationAction.NotificationChannelsChanged
                }),
                topics: ['user-user-1'],
                channels: [NotificationDistributionMethod.Topical]
            })
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
        expect(sent.at(-1)?.text).toContain('Connect Telegram')
    })

    it('does not connect an account that can no longer sign in', async () => {
        const { service, notifications } = createService({
            user: { ...activeUser, status: UserStatus.Deleted } as User
        })
        const token = startToken(await service.connectLink('user-1'))

        await service.handleUpdate(privateMessage(`/start ${token}`))

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

    it('stops on /stop and when the user blocks the bot', async () => {
        const { service } = createService()
        await service.handleUpdate(
            privateMessage(`/start ${startToken(await service.connectLink('user-1'))}`)
        )

        await service.handleUpdate(privateMessage('/stop'))
        expect(await service.isConnected('user-1')).toBe(false)

        await service.handleUpdate(
            privateMessage(`/start ${startToken(await service.connectLink('user-1'))}`)
        )
        await service.handleUpdate({
            update_id: 2,
            my_chat_member: {
                chat: { id: 42, type: 'private' },
                new_chat_member: { status: 'kicked' }
            }
        })
        expect(await service.isConnected('user-1')).toBe(false)
    })

    it('disconnects every chat a user connected from the site', async () => {
        const { service } = createService()
        await service.handleUpdate(
            privateMessage(`/start ${startToken(await service.connectLink('user-1'))}`, 1)
        )
        await service.handleUpdate(
            privateMessage(`/start ${startToken(await service.connectLink('user-1'))}`, 2)
        )

        await service.disconnect('user-1')

        expect(await service.isConnected('user-1')).toBe(false)
    })

    it('ignores updates it does not understand', async () => {
        const { service, sent } = createService()
        await service.handleUpdate({ nonsense: true })
        await service.handleUpdate({ update_id: 3, edited_message: {} })
        expect(sent).toEqual([])
    })
})
