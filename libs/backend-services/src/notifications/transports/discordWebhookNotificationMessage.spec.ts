import { describe, expect, it } from 'vitest'
import {
    NotificationCategory,
    UserNotificationAction,
    type UserNotification
} from '@tabletop/common'
import { MessageFlags } from 'discord-api-types/v10'
import { discordWebhookNotificationMessage } from './discordWebhookNotificationMessage.js'

const turn: UserNotification = {
    id: 'n-1',
    type: NotificationCategory.User,
    action: UserNotificationAction.IsYourTurn,
    data: { user: { id: 'u-1' }, game: { id: 'game-1', typeId: '1846', name: 'Friday night' } }
}

describe('discordWebhookNotificationMessage', () => {
    it('mentions the linked player in one line linking the game', () => {
        expect(
            discordWebhookNotificationMessage(turn, {
                frontendHost: 'https://example.com',
                gameTitle: '1846',
                mentionUserId: '99',
                locale: 'en'
            })
        ).toEqual({
            username: 'BoardTogether',
            avatar_url: 'https://example.com/android-chrome-192x192.png',
            content:
                "<@99> It's your turn in 1846 · [Friday night](https://example.com/game/game-1)",
            flags: MessageFlags.SuppressEmbeds,
            allowed_mentions: { parse: [], users: ['99'] }
        })
    })

    it('mentions no one when the player has not linked Discord', () => {
        const message = discordWebhookNotificationMessage(turn, {
            frontendHost: 'https://example.com',
            locale: 'en'
        })
        expect(message.content).toBe(
            "It's your turn in [Friday night](https://example.com/game/game-1)"
        )
        expect(message.allowed_mentions).toEqual({ parse: [], users: [] })
    })

    it('links an invitation to the dashboard', () => {
        const invited: UserNotification = {
            id: 'n-2',
            type: NotificationCategory.User,
            action: UserNotificationAction.WasInvited,
            data: {
                user: { id: 'u-1' },
                owner: { id: 'u-2', username: 'bob_b' },
                game: { id: 'game-1', typeId: '1846', name: 'Friday night' }
            }
        }
        expect(
            discordWebhookNotificationMessage(invited, {
                frontendHost: 'https://example.com',
                locale: 'en'
            }).content
        ).toBe('bob\\_b invited you to [Friday night](https://example.com/dashboard)')
    })

    it('escapes markdown in names players choose', () => {
        const message = discordWebhookNotificationMessage(
            {
                ...turn,
                data: { ...turn.data, game: { ...turn.data.game, name: '**big** [x](y)' } }
            },
            { frontendHost: 'https://example.com', locale: 'en' }
        )
        expect(message.content).toBe(
            "It's your turn in [\\*\\*big\\*\\* \\[x\\]\\(y\\)](https://example.com/game/game-1)"
        )
    })
})
