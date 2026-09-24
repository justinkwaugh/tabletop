import { describe, expect, it } from 'vitest'
import {
    NotificationCategory,
    UserNotificationAction,
    type UserNotification
} from '@tabletop/common'
import { ButtonStyle, ComponentType } from 'discord-api-types/v10'
import { discordNotificationMessage } from './discordNotificationMessage.js'

const game = { id: 'game-1', typeId: 'lowenherz', name: 'Friday night' }
const sentAt = new Date('2026-09-24T21:14:00.000Z')

describe('discordNotificationMessage', () => {
    it('renders a turn notification as a linked card with a button', () => {
        const notification: UserNotification = {
            id: 'n-1',
            type: NotificationCategory.User,
            action: UserNotificationAction.IsYourTurn,
            data: { user: { id: 'u-1' }, game }
        }

        const message = discordNotificationMessage(notification, {
            frontendHost: 'https://example.com',
            gameTitle: 'Löwenherz',
            coverImageUrl: 'https://example.com/games/lowenherz/cover.jpg',
            sentAt
        })

        expect(message).toEqual({
            content: "It's your turn in Friday night",
            embeds: [
                {
                    author: { name: "It's your turn" },
                    title: 'Friday night',
                    url: 'https://example.com/game/game-1',
                    description: 'Löwenherz',
                    color: 0x22c55e,
                    thumbnail: { url: 'https://example.com/games/lowenherz/cover.jpg' },
                    footer: { text: 'BoardTogether' },
                    timestamp: '2026-09-24T21:14:00.000Z'
                }
            ],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Link,
                            label: 'Take your turn',
                            url: 'https://example.com/game/game-1'
                        }
                    ]
                }
            ],
            allowed_mentions: { parse: [] }
        })
    })

    it('links invitations to the dashboard and omits a missing cover', () => {
        const notification: UserNotification = {
            id: 'n-2',
            type: NotificationCategory.User,
            action: UserNotificationAction.WasInvited,
            data: { user: { id: 'u-1' }, owner: { id: 'u-2', username: 'alex' }, game }
        }

        const message = discordNotificationMessage(notification, {
            frontendHost: 'https://example.com',
            sentAt
        })

        expect(message.content).toBe('alex invited you to Friday night')
        expect(message.embeds?.[0]).toMatchObject({
            author: { name: 'alex invited you to play' },
            url: 'https://example.com/dashboard',
            thumbnail: undefined,
            description: undefined
        })
        expect(message.components?.[0]).toMatchObject({
            components: [{ label: 'View invitation', url: 'https://example.com/dashboard' }]
        })
    })
})
