import { describe, expect, it } from 'vitest'
import {
    NotificationCategory,
    UserNotificationAction,
    type UserNotification
} from '@tabletop/common'
import { telegramNotificationMessage } from './telegramNotificationMessage.js'

describe('telegramNotificationMessage', () => {
    it('sends a turn notification with the game, title and a button to the game', () => {
        const notification: UserNotification = {
            id: 'n-1',
            type: NotificationCategory.User,
            action: UserNotificationAction.IsYourTurn,
            data: {
                user: { id: 'u-1' },
                game: { id: 'game-1', typeId: '1846', name: 'Friday night' }
            }
        }

        expect(
            telegramNotificationMessage(notification, '42', {
                frontendHost: 'https://example.com',
                gameTitle: '1846',
                locale: 'en'
            })
        ).toEqual({
            chat_id: '42',
            text: "<b>It's your turn</b>\nFriday night · 1846",
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Take your turn', url: 'https://example.com/game/game-1' }]
                ]
            }
        })
    })

    it('escapes HTML in names players choose', () => {
        const notification: UserNotification = {
            id: 'n-2',
            type: NotificationCategory.User,
            action: UserNotificationAction.WasInvited,
            data: {
                user: { id: 'u-1' },
                owner: { id: 'u-2', username: '<b>Ann</b>' },
                game: { id: 'game-1', typeId: '1846', name: 'Rails & <i>ties</i>' }
            }
        }

        const message = telegramNotificationMessage(notification, '42', {
            frontendHost: 'https://example.com',
            locale: 'en'
        })

        expect(message.text).toBe(
            '<b>&lt;b&gt;Ann&lt;/b&gt; invited you to play</b>\nRails &amp; &lt;i&gt;ties&lt;/i&gt;'
        )
        expect(message.reply_markup?.inline_keyboard[0][0].url).toBe(
            'https://example.com/dashboard'
        )
    })

    it("writes the notification in the player's language", () => {
        const notification: UserNotification = {
            id: 'n-3',
            type: NotificationCategory.User,
            action: UserNotificationAction.IsYourTurn,
            data: {
                user: { id: 'u-1' },
                game: { id: 'game-1', typeId: '1846', name: 'Freitagabend' }
            }
        }

        const message = telegramNotificationMessage(notification, '42', {
            frontendHost: 'https://example.com',
            locale: 'de'
        })

        expect(message.text).toBe('<b>Du bist am Zug</b>\nFreitagabend')
        expect(message.reply_markup?.inline_keyboard[0][0].text).toBe('Zug machen')
    })
})
