import { SecretsService } from '../../secrets/secretsService.js'
import {
    Notification,
    NotificationCategory,
    UserNotification,
    UserNotificationAction
} from '@tabletop/common'
// import {
//     APIBaseInteraction,
//     APIApplicationCommandInteraction,
//     InteractionResponseType,
//     InteractionType
// } from 'discord-api-types/v10'

import { Client, Events, GatewayIntentBits } from 'discord.js'
import { GameService } from '../../games/gameService.js'
import { DiscordSubscription } from '../subscriptions/discordSubscription.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'

const FRONTEND_HOST = process.env.FRONTEND_HOST ?? ''

export class DiscordTransport implements NotificationTransport {
    type = TransportType.Discord

    private client = new Client({ intents: [GatewayIntentBits.Guilds] })
    private clientReady = false

    constructor(
        private readonly gameService: GameService,
        private readonly botToken: string
    ) {
        this.client.once(Events.ClientReady, (readyClient) => {
            console.log(`Discord Ready! Logged in as ${readyClient.user.tag}`)
            this.clientReady = true
        })
    }

    static async createDiscordTransport(
        secretsService: SecretsService,
        gameService: GameService
    ): Promise<DiscordTransport> {
        const botToken = await secretsService.getSecret('DISCORD_BOT_TOKEN')
        const transport = new DiscordTransport(gameService, botToken)
        await transport.login()
        return transport
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
        if (!this.clientReady) {
            await this.login()
        }

        const user = await this.client.users.fetch(userId)
        if (!user) {
            console.error(`User ${userId} not found`)
            return
        }

        if (!user.dmChannel) {
            await user.createDM()
        }

        await user.send(message)
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

    async login() {
        this.client.login(this.botToken).catch((e) => {
            console.error('Error logging in Discord client', e)
        })
    }

    private gameTitle(typeId: string): string | undefined {
        return this.gameService.getTitle(typeId)?.metadata.name
    }
}
