import { canHoldAuthenticatedSession, ExternalAuthService, type User } from '@tabletop/common'
import { m, messageLocale, replyLocale, type Locale } from '@tabletop/email/i18n'
import {
    APIBaseInteraction,
    APIApplicationCommandInteraction,
    APIWebhookEvent,
    ApplicationIntegrationType,
    ApplicationWebhookEventType,
    ApplicationWebhookType,
    InteractionResponseType,
    InteractionType,
    MessageFlags
} from 'discord-api-types/v10'

import { UserService } from '../users/userService.js'
import { NotificationService } from '../notifications/notificationService.js'
import { DiscordSubscription } from '../notifications/subscriptions/discordSubscription.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import { DiscordTransport } from '../notifications/transports/discordTransport.js'
import { userTopic } from '../notifications/topics.js'
import { announceTopicRegistrationsChanged } from '../notifications/topicRegistrationsChanged.js'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'

const TEST_DISCORD_USER_ID = process.env['TEST_DISCORD_USER_ID']
const NOTIFY_COMMAND_NAME = 'notify'
const STOP_COMMAND_NAME = 'stop'

export class DiscordService {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly userService: UserService,
        private readonly discordTransport: DiscordTransport | undefined,
        private readonly subscriptions: Pick<
            NotificationStore,
            'findNotificationSubscriptions' | 'findSubscriptionTopics'
        >
    ) {
        if (TEST_DISCORD_USER_ID) {
            this.notificationService
                .registerNotificationSubscription({
                    subscription: this.subscriptionFor(TEST_DISCORD_USER_ID),
                    topic: userTopic('XbPcqp2m_ymbv2Q7Tw-gy')
                })
                .catch(console.error)
        }
    }

    get isAvailable(): boolean {
        return this.discordTransport !== undefined
    }

    async disconnect(userId: string): Promise<void> {
        const registered = await this.subscriptions.findNotificationSubscriptions(userTopic(userId))
        for (const subscription of registered) {
            if (subscription.transport === TransportType.Discord) {
                await this.notificationService.unregisterNotificationSubscription(subscription)
            }
        }
        await announceTopicRegistrationsChanged(this.notificationService, [userTopic(userId)])
    }

    async handleInteraction(interaction: APIBaseInteraction<InteractionType, unknown>) {
        if (interaction.type === InteractionType.ApplicationCommand) {
            const commandInteraction = interaction as APIApplicationCommandInteraction
            if (commandInteraction.data.name === NOTIFY_COMMAND_NAME) {
                return this.handleNotifyCommand(commandInteraction)
            } else if (commandInteraction.data.name === STOP_COMMAND_NAME) {
                return this.handleStopCommand(commandInteraction)
            } else {
                return { type: InteractionResponseType.Pong }
            }
        } else {
            return { type: InteractionResponseType.Pong }
        }
    }

    async handleWebhookEvent(webhookEvent: APIWebhookEvent) {
        if (webhookEvent.type !== ApplicationWebhookType.Event) {
            return
        }

        const { event } = webhookEvent
        if (
            event.type === ApplicationWebhookEventType.ApplicationAuthorized &&
            event.data.integration_type === ApplicationIntegrationType.UserInstall
        ) {
            await this.subscribeNewInstall(event.data.user.id)
        } else if (event.type === ApplicationWebhookEventType.ApplicationDeauthorized) {
            await this.unsubscribe(event.data.user.id)
        }
    }

    private async handleNotifyCommand(commandInteraction: APIApplicationCommandInteraction) {
        const discordUserId = commandInteraction.user?.id ?? commandInteraction.member?.user?.id
        const user = discordUserId ? await this.linkedUser(discordUserId) : undefined
        const locale = replyLocale(user, commandInteraction.locale)
        if (!discordUserId) {
            return this.reply(m.discord_unknown_user({}, { locale }))
        }
        if (!user) {
            return this.reply(m.discord_not_linked({}, { locale }))
        }

        await this.subscribe(discordUserId, user)
        return this.reply(m.discord_notify_started({}, { locale }))
    }

    private async handleStopCommand(commandInteraction: APIApplicationCommandInteraction) {
        const discordUserId = commandInteraction.user?.id ?? commandInteraction.member?.user?.id
        const user = discordUserId ? await this.linkedUser(discordUserId) : undefined
        const locale = replyLocale(user, commandInteraction.locale)
        if (!discordUserId) {
            return this.reply(m.discord_unknown_user({}, { locale }))
        }

        await this.unsubscribe(discordUserId)
        return this.reply(m.discord_notify_stopped({}, { locale }))
    }

    private reply(content: string) {
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content, flags: MessageFlags.Ephemeral }
        }
    }

    private async linkedUser(discordUserId: string): Promise<User | undefined> {
        const user = await this.userService.getUserByExternalId(
            discordUserId,
            ExternalAuthService.Discord
        )
        return user && canHoldAuthenticatedSession(user) ? user : undefined
    }

    private async subscribe(discordUserId: string, user: User) {
        await this.notificationService.registerNotificationSubscription({
            subscription: this.subscriptionFor(discordUserId),
            topic: userTopic(user.id)
        })
        await announceTopicRegistrationsChanged(this.notificationService, [userTopic(user.id)])
    }

    private async subscribeNewInstall(discordUserId: string) {
        const user = await this.linkedUser(discordUserId)
        if (!user) return
        await this.subscribe(discordUserId, user)
        this.sendInstallWelcome(discordUserId, messageLocale(user))
    }

    // Not awaited: Discord requires a webhook event response within 3 seconds.
    private sendInstallWelcome(discordUserId: string, locale: Locale) {
        this.discordTransport
            ?.sendMessage({
                userId: discordUserId,
                message: { content: m.discord_install_welcome({}, { locale }) }
            })
            .catch((error: unknown) => {
                console.error('Could not send the Discord install welcome', discordUserId, error)
            })
    }

    private async unsubscribe(discordUserId: string) {
        const subscription = this.subscriptionFor(discordUserId)
        const topics = await this.subscriptions.findSubscriptionTopics(subscription)
        if (topics.length === 0) return
        await this.notificationService.unregisterNotificationSubscription(subscription)
        await announceTopicRegistrationsChanged(this.notificationService, topics)
    }

    private subscriptionFor(discordUserId: string): DiscordSubscription {
        return {
            id: discordUserId,
            transport: TransportType.Discord,
            discordUserId
        }
    }
}
