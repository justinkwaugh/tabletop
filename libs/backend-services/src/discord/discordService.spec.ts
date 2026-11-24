import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ExternalAuthService,
    SystemNotificationAction,
    UserStatus,
    type User
} from '@tabletop/common'
import {
    ApplicationIntegrationType,
    ApplicationWebhookEventType,
    ApplicationWebhookType,
    OAuth2Scopes,
    type APIUser,
    type APIWebhookEvent
} from 'discord-api-types/v10'
import { DiscordService } from './discordService.js'
import { UserService } from '../users/userService.js'
import { NotificationService } from '../notifications/notificationService.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import { DiscordTransport } from '../notifications/transports/discordTransport.js'
import type { DiscordSubscription } from '../notifications/subscriptions/discordSubscription.js'

const discordUser: APIUser = {
    id: 'discord-1',
    username: 'player',
    discriminator: '0',
    global_name: 'Player',
    avatar: null
}

const linkedUser: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [],
    externalIds: []
}

const expectedSubscription: DiscordSubscription = {
    id: discordUser.id,
    transport: TransportType.Discord,
    discordUserId: discordUser.id
}

function authorizedEvent(integrationType: ApplicationIntegrationType): APIWebhookEvent {
    return {
        version: 1,
        application_id: 'app-1',
        type: ApplicationWebhookType.Event,
        event: {
            type: ApplicationWebhookEventType.ApplicationAuthorized,
            timestamp: '2026-09-30T12:00:00.000Z',
            data: {
                integration_type: integrationType,
                user: discordUser,
                scopes: [OAuth2Scopes.ApplicationsCommands]
            }
        }
    }
}

const deauthorizedEvent: APIWebhookEvent = {
    version: 1,
    application_id: 'app-1',
    type: ApplicationWebhookType.Event,
    event: {
        type: ApplicationWebhookEventType.ApplicationDeauthorized,
        timestamp: '2026-09-30T12:00:00.000Z',
        data: { user: discordUser }
    }
}

describe('DiscordService webhook events', () => {
    let notificationService: NotificationService
    let userService: UserService
    let discordTransport: DiscordTransport
    let service: DiscordService

    beforeEach(() => {
        notificationService = {
            addTopicTransport: vi.fn(),
            addTopicListener: vi.fn(),
            removeTopicListener: vi.fn(),
            addTransport: vi.fn(),
            registerNotificationSubscription: vi.fn().mockResolvedValue(undefined),
            unregisterNotificationSubscription: vi.fn().mockResolvedValue(undefined),
            hasUserDirectSubscription: vi.fn(),
            sendNotification: vi.fn()
        }
        userService = Object.create(UserService.prototype)
        vi.spyOn(userService, 'getUserByExternalId').mockResolvedValue(linkedUser)
        discordTransport = Object.create(DiscordTransport.prototype)
        vi.spyOn(discordTransport, 'sendMessage').mockResolvedValue(undefined)
        service = new DiscordService(notificationService, userService, discordTransport, {
            findNotificationSubscriptions: async (topic: string) =>
                topic === `user-${linkedUser.id}` ? [expectedSubscription] : [],
            findSubscriptionTopics: async () => [`user-${linkedUser.id}`]
        })
    })

    it('does not subscribe or welcome a banned user who adds the bot', async () => {
        vi.spyOn(userService, 'getUserByExternalId').mockResolvedValue({
            ...linkedUser,
            status: UserStatus.Inactive
        })

        await service.handleWebhookEvent(authorizedEvent(ApplicationIntegrationType.UserInstall))

        expect(notificationService.registerNotificationSubscription).not.toHaveBeenCalled()
        expect(discordTransport.sendMessage).not.toHaveBeenCalled()
    })

    it('subscribes a linked user as soon as they add the bot to their account', async () => {
        await service.handleWebhookEvent(authorizedEvent(ApplicationIntegrationType.UserInstall))

        expect(userService.getUserByExternalId).toHaveBeenCalledWith(
            discordUser.id,
            ExternalAuthService.Discord
        )
        expect(notificationService.registerNotificationSubscription).toHaveBeenCalledWith({
            subscription: expectedSubscription,
            topic: `user-${linkedUser.id}`
        })
    })

    it('welcomes a newly subscribed user with a direct message', async () => {
        await service.handleWebhookEvent(authorizedEvent(ApplicationIntegrationType.UserInstall))

        expect(discordTransport.sendMessage).toHaveBeenCalledWith({
            userId: discordUser.id,
            message: { content: expect.stringContaining('/stop') }
        })
    })

    it('keeps the subscription when the welcome message cannot be sent', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(discordTransport, 'sendMessage').mockRejectedValue(new Error('network down'))

        await expect(
            service.handleWebhookEvent(authorizedEvent(ApplicationIntegrationType.UserInstall))
        ).resolves.toBeUndefined()
        expect(notificationService.registerNotificationSubscription).toHaveBeenCalled()
    })

    it('does not subscribe a Discord user without a linked account', async () => {
        vi.spyOn(userService, 'getUserByExternalId').mockResolvedValue(undefined)

        await service.handleWebhookEvent(authorizedEvent(ApplicationIntegrationType.UserInstall))

        expect(notificationService.registerNotificationSubscription).not.toHaveBeenCalled()
        expect(discordTransport.sendMessage).not.toHaveBeenCalled()
    })

    it('does not subscribe the user who adds the bot to a server', async () => {
        await service.handleWebhookEvent(authorizedEvent(ApplicationIntegrationType.GuildInstall))

        expect(notificationService.registerNotificationSubscription).not.toHaveBeenCalled()
    })

    it('unsubscribes a user who removes the bot', async () => {
        await service.handleWebhookEvent(deauthorizedEvent)

        expect(notificationService.unregisterNotificationSubscription).toHaveBeenCalledWith(
            expectedSubscription
        )
    })

    it('tells an open Notifications page when a user adds or removes the bot', async () => {
        await service.handleWebhookEvent(authorizedEvent(ApplicationIntegrationType.UserInstall))
        await service.handleWebhookEvent(deauthorizedEvent)

        expect(notificationService.sendNotification).toHaveBeenCalledTimes(2)
        expect(notificationService.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                notification: expect.objectContaining({
                    action: SystemNotificationAction.TopicRegistrationsChanged
                }),
                topics: [`user-${linkedUser.id}`]
            })
        )
    })

    it('stops direct messages when the user disconnects on the Notifications page', async () => {
        await service.disconnect(linkedUser.id)

        expect(notificationService.unregisterNotificationSubscription).toHaveBeenCalledWith(
            expectedSubscription
        )
        expect(notificationService.sendNotification).toHaveBeenCalled()
    })
})
