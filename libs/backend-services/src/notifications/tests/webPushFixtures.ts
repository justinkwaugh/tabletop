import { createECDH, randomBytes } from 'node:crypto'
import type { WebPushSubscriptionClientData } from '../subscriptions/webPushSubscription.js'

export const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/dGVzdA:APA91bFakeRegistrationToken'
export const MOZILLA_ENDPOINT =
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABmFakeMozillaToken'
export const APPLE_ENDPOINT = 'https://web.push.apple.com/QFakeAppleToken'
export const WNS_ENDPOINT = 'https://wns2-db5p.notify.windows.com/w/?token=AwYAAAFakeWnsToken'
export const CHROME_CANARY_ENDPOINT = 'https://jmt17.google.com/fcm/send/eFakeCanaryToken'

// 0x04 followed by the affine coordinates (0, 0), which do not satisfy the P-256 curve equation
export const OFF_CURVE_P256DH = Buffer.concat([Buffer.from([0x04]), Buffer.alloc(64)]).toString(
    'base64url'
)

export function webPushKeys(): WebPushSubscriptionClientData['keys'] {
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    return {
        p256dh: ecdh.getPublicKey().toString('base64url'),
        auth: randomBytes(16).toString('base64url')
    }
}

export function webPushClientData(endpoint: string): WebPushSubscriptionClientData {
    return { endpoint, expirationTime: null, keys: webPushKeys() }
}
