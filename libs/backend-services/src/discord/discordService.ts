import { ExternalAuthService } from '@tabletop/common'
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

const TEST_DISCORD_USER_ID = process.env['TEST_DISCORD_USER_ID']
const NOTIFY_COMMAND_NAME = 'notify'
const STOP_COMMAND_NAME = 'stop'
const INSTALL_WELCOME_MESSAGE =
    "You're all set! I'll message you here when it's your turn or you're invited to a game on BoardTogether. Type /stop to turn these notifications off."

export class DiscordService {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly userService: UserService,
        private readonly discordTransport: DiscordTransport | undefined
    ) {
        if (TEST_DISCORD_USER_ID) {
            this.notificationService
                .registerNotificationSubscription({
                    subscription: this.subscriptionFor(TEST_DISCORD_USER_ID),
                    topic: `user-XbPcqp2m_ymbv2Q7Tw-gy`
                })
                .catch(console.error)
        }
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
        if (!discordUserId) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: 'For some reason I could not identify your user id.  Try again?',
                    flags: MessageFlags.Ephemeral
                }
            }
        }

        const subscribed = await this.subscribeLinkedUser(discordUserId)
        if (!subscribed) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content:
                        'Could not find your Discord linked user account on BoardTogether, please login there and go to your profile and link your Discord account.',
                    flags: MessageFlags.Ephemeral
                }
            }
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: 'You will now be notified.  Type /stop to stop notifications.',
                flags: MessageFlags.Ephemeral
            }
        }
    }

    private async handleStopCommand(commandInteraction: APIApplicationCommandInteraction) {
        const discordUserId = commandInteraction.user?.id ?? commandInteraction.member?.user?.id
        if (!discordUserId) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: 'For some reason I could not identify your user id.  Try again?',
                    flags: MessageFlags.Ephemeral
                }
            }
        }

        await this.unsubscribe(discordUserId)
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: 'Notifications will no longer be sent.',
                flags: MessageFlags.Ephemeral
            }
        }
    }

    private async subscribeLinkedUser(discordUserId: string): Promise<boolean> {
        const user = await this.userService.getUserByExternalId(
            discordUserId,
            ExternalAuthService.Discord
        )
        if (!user) {
            return false
        }

        await this.notificationService.registerNotificationSubscription({
            subscription: this.subscriptionFor(discordUserId),
            topic: `user-${user.id}`
        })
        return true
    }

    private async subscribeNewInstall(discordUserId: string) {
        const subscribed = await this.subscribeLinkedUser(discordUserId)
        if (subscribed) {
            this.sendInstallWelcome(discordUserId)
        }
    }

    // Not awaited: Discord requires a webhook event response within 3 seconds.
    private sendInstallWelcome(discordUserId: string) {
        this.discordTransport
            ?.sendMessage({ userId: discordUserId, message: { content: INSTALL_WELCOME_MESSAGE } })
            .catch((error: unknown) => {
                console.error('Could not send the Discord install welcome', discordUserId, error)
            })
    }

    private async unsubscribe(discordUserId: string) {
        await this.notificationService.unregisterNotificationSubscription(
            this.subscriptionFor(discordUserId)
        )
    }

    private subscriptionFor(discordUserId: string): DiscordSubscription {
        return {
            id: discordUserId,
            transport: TransportType.Discord,
            discordUserId
        }
    }
}
