import {
    GameCatalogEntry,
    Notification,
    NotificationCategory,
    UserNotification
} from '@tabletop/common'

import { CatalogService } from '../../games/catalogService.js'
import { LibraryService } from '../../games/libraryService.js'
import { DiscordSubscription } from '../subscriptions/discordSubscription.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'
import { discordNotificationMessage } from './discordNotificationMessage.js'
import { DiscordBotApi } from '../../discord/discordBotApi.js'

import {
    RESTPostAPIChannelMessageJSONBody,
    RESTPostAPICurrentUserCreateDMChannelJSONBody,
    RESTPostAPICurrentUserCreateDMChannelResult
} from 'discord-api-types/v10'

const FRONTEND_HOST = process.env.FRONTEND_HOST ?? ''

export class DiscordTransport implements NotificationTransport {
    type = TransportType.Discord
    private dmCache: Map<string, string> = new Map()

    constructor(
        private readonly libraryService: LibraryService,
        private readonly catalogService: CatalogService,
        private readonly discordBotApi: DiscordBotApi
    ) {}

    async sendNotification(
        subscription: DiscordSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        const message = await this.generateMessage(notification)
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

    async sendMessage({
        userId,
        message
    }: {
        userId: string
        message: RESTPostAPIChannelMessageJSONBody
    }) {
        const channelId = await this.getDmChannelId(userId)
        if (!channelId) {
            console.error('Could not get DM channel for user', userId)
            return
        }

        const messageResponse = await this.discordBotApi.post(
            `/channels/${channelId}/messages`,
            message
        )

        if (!messageResponse.ok) {
            console.error('Could not send DM to user', userId, messageResponse)
            return
        }
    }

    private async getDmChannelId(userId: string): Promise<string | undefined> {
        let channelId = this.dmCache.get(userId)
        if (!channelId) {
            const dmLookupRequestData: RESTPostAPICurrentUserCreateDMChannelJSONBody = {
                recipient_id: userId
            }

            const response = await this.discordBotApi.post(
                '/users/@me/channels',
                dmLookupRequestData
            )

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

    private async generateMessage(
        notification: Notification
    ): Promise<RESTPostAPIChannelMessageJSONBody | undefined> {
        if (!this.isUserNotification(notification)) {
            return
        }

        const catalogEntry = await this.catalogEntry(notification.data.game.typeId)
        return discordNotificationMessage(notification, {
            frontendHost: FRONTEND_HOST,
            gameTitle: catalogEntry?.metadata.name,
            thumbnailUrl: catalogEntry?.thumbnailUrl,
            sentAt: new Date()
        })
    }

    private isUserNotification(notification: Notification): notification is UserNotification {
        return notification.type === NotificationCategory.User
    }

    private async catalogEntry(typeId: string): Promise<GameCatalogEntry | undefined> {
        try {
            const manifest = await this.libraryService.getManifest()
            const catalog = await this.catalogService.getCatalog(manifest)
            return catalog.find((entry) => entry.id === typeId)
        } catch (error) {
            console.error('Could not load the game catalog for a Discord notification', error)
            return undefined
        }
    }
}
