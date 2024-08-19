import { SecretsService } from '../../secrets/secretsService.js'
import {
    Notification,
    NotificationCategory,
    UserNotification,
    UserNotificationAction
} from '@tabletop/common'

import { GameService } from '../../games/gameService.js'
import { DiscordSubscription } from '../subscriptions/discordSubscription.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'

import {
    RESTPostAPIChannelMessageJSONBody,
    RESTPostAPICurrentUserCreateDMChannelJSONBody,
    RESTPostAPICurrentUserCreateDMChannelResult
} from 'discord-api-types/v10'

const FRONTEND_HOST = process.env.FRONTEND_HOST ?? ''
const API_ENDPOINT = 'https://discord.com/api/v10'

export class DiscordTransport implements NotificationTransport {
    type = TransportType.Discord
    private dmCache: Map<string, string> = new Map()

    constructor(
        private readonly gameService: GameService,
        private readonly botToken: string
    ) {}

    static async createDiscordTransport(
        secretsService: SecretsService,
        gameService: GameService
    ): Promise<DiscordTransport> {
        const botToken = await secretsService.getSecret('DISCORD_BOT_TOKEN')
        return new DiscordTransport(gameService, botToken)
    }

    async sendNotification(
        subscription: DiscordSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        const message = this.generateMessage(notification)
        if (!message) {
            return {
                success: false,
                unregister: false
            }
        }
        await this.sendMessage({ userId: subscription.discordUserId, message })

        return {
            success: true,
            unregister: false
        }
    }

    async sendMessage({ userId, message }: { userId: string; message: string }) {
        const channelId = await this.getDmChannelId(userId)
        if (!channelId) {
            console.error('Could not get DM channel for user', userId)
            return
        }

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bot ${this.botToken}`,
            Accept: 'application/json'
        }

        const messageData: RESTPostAPIChannelMessageJSONBody = {
            content: message
        }

        const messageResponse = await fetch(`${API_ENDPOINT}/channels/${channelId}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(messageData)
        })

        if (!messageResponse.ok) {
            console.error('Could not send DM to user', userId, messageResponse)
            return
        }
    }

    private async getDmChannelId(userId: string): Promise<string | undefined> {
        let channelId = this.dmCache.get(userId)
        if (!channelId) {
            const headers = {
                'Content-Type': 'application/json',
                Authorization: `Bot ${this.botToken}`,
                Accept: 'application/json'
            }
            const dmLookupRequestData: RESTPostAPICurrentUserCreateDMChannelJSONBody = {
                recipient_id: userId
            }

            const response = await fetch(`${API_ENDPOINT}/users/@me/channels`, {
                method: 'POST',
                headers,
                body: JSON.stringify(dmLookupRequestData)
            })

            if (!response.ok) {
                console.error('Discord error getting dm channel for user', userId, response)
                return
            }

            const channelResult =
                (await response.json()) as RESTPostAPICurrentUserCreateDMChannelResult

            channelId = channelResult.id
            this.dmCache.set(userId, channelId)
        }
        return channelId
    }

    private generateMessage(notification: Notification): string | undefined {
        if (!this.isUserNotification(notification)) {
            return
        }

        if (notification.action === UserNotificationAction.PlayerJoined) {
            const url = `${FRONTEND_HOST}/dashboard`
            const title = this.gameTitle(notification.data.game.typeId)
            return `${notification.data.player.name} joined your ${title} game [${notification.data.game.name}](${url})`
        } else if (notification.action === UserNotificationAction.PlayerDeclined) {
            const url = `${FRONTEND_HOST}/dashboard`
            const title = this.gameTitle(notification.data.game.typeId)
            return `${notification.data.player.name} has declined to join your ${title} game [${notification.data.game.name}](${url})`
        } else if (notification.action === UserNotificationAction.GameStarted) {
            const url = `${FRONTEND_HOST}/game/${notification.data.game.id}`
            const title = this.gameTitle(notification.data.game.typeId)
            return `Your ${title} game [${notification.data.game.name}](${url}) has begun!`
        } else if (notification.action === UserNotificationAction.WasInvited) {
            const url = `${FRONTEND_HOST}/dashboard`
            const title = this.gameTitle(notification.data.game.typeId)
            return `${notification.data.owner.username} invited you to join their ${title} game [${notification.data.game.name}](${url})`
        } else if (notification.action === UserNotificationAction.IsYourTurn) {
            const url = `${FRONTEND_HOST}/game/${notification.data.game.id}`
            const title = this.gameTitle(notification.data.game.typeId)
            return `It's your turn in your ${title} game [${notification.data.game.name}](${url})`
        }
        return
    }

    private isUserNotification(notification: Notification): notification is UserNotification {
        return notification.type === NotificationCategory.User
    }

    private gameTitle(typeId: string): string | undefined {
        return this.gameService.getTitle(typeId)?.metadata.name
    }
}
