import { ExternalAuthService } from '@tabletop/common'
import {
    APIBaseInteraction,
    APIApplicationCommandInteraction,
    InteractionResponseType,
    InteractionType,
    MessageFlags
} from 'discord-api-types/v10'

import { UserService } from '../users/userService.js'
import { NotifyCommand } from './notify.js'
import { NotificationService } from '../notifications/notificationService.js'
import { DiscordSubscription } from '../notifications/subscriptions/discordSubscription.js'
import { StopCommand } from './stop.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'

const TEST_DISCORD_USER_ID = process.env['TEST_DISCORD_USER_ID']

export class DiscordService {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly userService: UserService
    ) {
        if (TEST_DISCORD_USER_ID) {
            const subscription: DiscordSubscription = {
                id: TEST_DISCORD_USER_ID,
                transport: TransportType.Discord,
                discordUserId: TEST_DISCORD_USER_ID
            }

            this.notificationService
                .registerNotificationSubscription({
                    subscription,
                    topic: `user-XbPcqp2m_ymbv2Q7Tw-gy`
                })
                .catch(console.error)
        }
    }

    async handleInteraction(interaction: APIBaseInteraction<InteractionType, unknown>) {
        if (interaction.type === InteractionType.ApplicationCommand) {
            const commandInteraction = interaction as APIApplicationCommandInteraction
            if (commandInteraction.data.name === NotifyCommand.data.name) {
                return this.handleNotifyCommand(commandInteraction)
            } else if (commandInteraction.data.name === StopCommand.data.name) {
                return this.handleStopCommand(commandInteraction)
            } else {
                return { type: InteractionResponseType.Pong }
            }
        } else {
            return { type: InteractionResponseType.Pong }
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

        const user = await this.userService.getUserByExternalId(
            discordUserId,
            ExternalAuthService.Discord
        )
        if (!user) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content:
                        'Could not find your Discord linked user account on BoardTogether, please login there and go to your profile and link your Discord account.',
                    flags: MessageFlags.Ephemeral
                }
            }
        }

        const subscription: DiscordSubscription = {
            id: discordUserId,
            transport: TransportType.Discord,
            discordUserId
        }

        await this.notificationService.registerNotificationSubscription({
            subscription,
            topic: `user-${user.id}`
        })

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

        const subscription: DiscordSubscription = {
            id: discordUserId,
            transport: TransportType.Discord,
            discordUserId
        }

        await this.notificationService?.unregisterNotificationSubscription(subscription)
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: 'Notifications will no longer be sent.',
                flags: MessageFlags.Ephemeral
            }
        }
    }
}
