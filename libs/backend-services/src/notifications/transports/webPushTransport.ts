import { Notification } from '@tabletop/common'
import { WebPushSubscription } from '../subscriptions/webPushSubscription.js'
import { SecretsService } from '../../secrets/secretsService.js'
import { Type, type Static } from 'typebox'
import * as Value from 'typebox/value'
import webpush, { WebPushError } from 'web-push'
import crypto from 'crypto'

import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'
import { NotificationSubscriptionIdentifier } from '../subscriptions/notificationSubscriptionIdentifier.js'

export type WebPushSubscriptionClientData = Static<typeof WebPushSubscriptionClientData>
export const WebPushSubscriptionClientData = Type.Pick(WebPushSubscription, [
    'endpoint',
    'expirationTime',
    'keys'
])

export class WebPushTransport implements NotificationTransport {
    type = TransportType.WebPush

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
        return {
            id: this.hashString(data.endpoint),
            transport: TransportType.WebPush,
            ...data
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
        try {
            const clientData = Value.Clean(
                WebPushSubscriptionClientData,
                subscription
            ) as WebPushSubscriptionClientData
            await webpush.sendNotification(clientData, JSON.stringify(notification))
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
