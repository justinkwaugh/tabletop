import { Notification } from '@tabletop/common'
import https from 'node:https'
import {
    WebPushSubscription,
    WebPushSubscriptionClientData
} from '../subscriptions/webPushSubscription.js'
import {
    assertSupportedWebPushSubscription,
    webPushSubscriptionRejection
} from '../subscriptions/webPushSubscriptionPolicy.js'
import { SecretsService } from '../../secrets/secretsService.js'
import webpush, { WebPushError } from 'web-push'
import crypto from 'crypto'

import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'
import { NotificationSubscriptionIdentifier } from '../subscriptions/notificationSubscriptionIdentifier.js'
import { PublicInternetHttpsAgent } from './publicInternetAgent.js'

export const WEB_PUSH_SOCKET_TIMEOUT_MS = 10_000
export const WEB_PUSH_MAX_CONCURRENT_REQUESTS = 64

export class WebPushTransport implements NotificationTransport {
    type = TransportType.WebPush

    constructor(
        readonly agent: https.Agent = new PublicInternetHttpsAgent({
            maxSockets: WEB_PUSH_MAX_CONCURRENT_REQUESTS,
            maxTotalSockets: WEB_PUSH_MAX_CONCURRENT_REQUESTS
        })
    ) {}

    static async createWebPushTransport(secretsService: SecretsService): Promise<WebPushTransport> {
        const transport = new WebPushTransport()
        await transport.initialize(secretsService)
        return transport
    }

    private async initialize(secretsService: SecretsService): Promise<void> {
        const vapidPrivateKey = await secretsService.getSecret('VAPID_PRIVATE_KEY')
        const vapidPublicKey = process.env['VAPID_PUBLIC_KEY']
        const vapidEmail = process.env['VAPID_ADMIN_EMAIL']

        if (!vapidPrivateKey || !vapidPublicKey) {
            throw new Error('VAPID keys not found')
        }

        webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)
    }

    static webPushSubscriptionFromClientData(
        data: WebPushSubscriptionClientData
    ): WebPushSubscription {
        assertSupportedWebPushSubscription(data)
        return {
            id: this.hashString(data.endpoint),
            transport: TransportType.WebPush,
            endpoint: data.endpoint,
            expirationTime: data.expirationTime,
            keys: { p256dh: data.keys.p256dh, auth: data.keys.auth }
        }
    }

    static webPushSubscriptionIdentifierFromEndpoint(
        endpoint: string
    ): NotificationSubscriptionIdentifier {
        return {
            id: this.hashString(endpoint),
            transport: TransportType.WebPush
        }
    }

    private static hashString(data: string): string {
        const hash = crypto.createHash('sha256')
        hash.update(data)
        return hash.digest('hex')
    }

    async sendNotification(
        subscription: WebPushSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        const clientData: WebPushSubscriptionClientData = {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
            keys: subscription.keys
        }
        const rejection = webPushSubscriptionRejection(clientData)
        if (rejection !== undefined) {
            console.log(
                'Removing web push subscription with an unsupported destination:',
                rejection
            )
            return { success: false, unregister: true }
        }

        try {
            await webpush.sendNotification(clientData, JSON.stringify(notification), {
                agent: this.agent,
                timeout: WEB_PUSH_SOCKET_TIMEOUT_MS
            })
            return {
                success: true,
                unregister: false
            }
        } catch (e) {
            console.log('Error sending web push notification', e)
            if (e instanceof WebPushError && e.statusCode === 410) {
                return {
                    success: false,
                    unregister: true
                }
            } else {
                console.log('Error sending web push notification', e)
                return {
                    success: false,
                    unregister: false
                }
            }
        }
    }
}
