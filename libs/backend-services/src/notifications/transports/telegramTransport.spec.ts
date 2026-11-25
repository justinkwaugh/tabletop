import { describe, expect, it, vi } from 'vitest'
import {
    NotificationCategory,
    UserNotificationAction,
    type UserNotification
} from '@tabletop/common'
import type { TelegramResult } from '../../telegram/telegramBotApi.js'
import { telegramSubscriptionFor } from '../subscriptions/telegramSubscription.js'
import { TelegramTransport } from './telegramTransport.js'

const turn: UserNotification = {
    id: 'n-1',
    type: NotificationCategory.User,
    action: UserNotificationAction.IsYourTurn,
    data: { user: { id: 'u-1' }, game: { id: 'game-1', typeId: '1846', name: 'Friday night' } }
}

function transportAnswering(result: TelegramResult) {
    const sendMessage = vi.fn(async () => result)
    const transport = new TelegramTransport(
        {
            library: {
                getServedManifest: async () => ({ frontend: { version: '1.0.0' }, games: [] })
            },
            catalog: { getCatalog: async () => [] }
        },
        { sendMessage },
        'https://example.com'
    )
    return { transport, sendMessage }
}

async function send(result: TelegramResult) {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { transport } = transportAnswering(result)
    return transport.sendNotification(telegramSubscriptionFor('42'), turn, 'en')
}

describe('TelegramTransport', () => {
    it('sends the message to the subscribed chat', async () => {
        const { transport, sendMessage } = transportAnswering({ ok: true, result: {} })

        expect(await transport.sendNotification(telegramSubscriptionFor('42'), turn, 'en')).toEqual(
            {
                success: true,
                unregister: false
            }
        )
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ chat_id: '42' }))
    })

    it('drops a chat whose user blocked the bot', async () => {
        expect(
            await send({
                ok: false,
                errorCode: 403,
                description: 'Forbidden: bot was blocked by the user'
            })
        ).toEqual({ success: false, unregister: true })
    })

    it('drops a chat that no longer exists', async () => {
        expect(
            await send({ ok: false, errorCode: 400, description: 'Bad Request: chat not found' })
        ).toEqual({ success: false, unregister: true })
    })

    it('keeps a chat through rate limits and other errors', async () => {
        expect(
            await send({
                ok: false,
                errorCode: 429,
                description: 'Too Many Requests: retry after 5'
            })
        ).toEqual({ success: false, unregister: false })
        expect(
            await send({
                ok: false,
                errorCode: 400,
                description: 'Bad Request: message is too long'
            })
        ).toEqual({ success: false, unregister: false })
    })
})
