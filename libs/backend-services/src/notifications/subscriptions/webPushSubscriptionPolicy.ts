import { ECDH } from 'node:crypto'
import { UnsupportedWebPushSubscriptionError } from '../notificationErrors.js'
import {
    WEB_PUSH_ENDPOINT_MAX_LENGTH,
    type WebPushSubscriptionClientData
} from './webPushSubscription.js'

// Push services of the supported browsers: Chromium (including Chrome pre-release channels),
// Firefox and Safari subscribe through one host each; Edge subscribes through a per-datacenter
// Windows Notification Service host such as wns2-db5p.notify.windows.com
export const SUPPORTED_PUSH_SERVICE_HOSTS = [
    'fcm.googleapis.com',
    'jmt17.google.com',
    'updates.push.services.mozilla.com',
    'web.push.apple.com'
] as const
export const SUPPORTED_PUSH_SERVICE_DOMAINS = ['notify.windows.com'] as const

const P256_CURVE = 'prime256v1'
const P256DH_UNCOMPRESSED_POINT_BYTES = 65
const P256DH_UNCOMPRESSED_POINT_PREFIX = 0x04
const AUTH_SECRET_MIN_BYTES = 16

const supportedPushServiceSubdomains = SUPPORTED_PUSH_SERVICE_DOMAINS.map(
    (domain) => new RegExp(`^[a-z0-9-]+\\.${domain.replaceAll('.', '\\.')}$`)
)

export function isSupportedPushServiceHost(hostname: string): boolean {
    return (
        SUPPORTED_PUSH_SERVICE_HOSTS.some((host) => host === hostname) ||
        supportedPushServiceSubdomains.some((pattern) => pattern.test(hostname))
    )
}

function isPointOnP256(point: Buffer): boolean {
    try {
        ECDH.convertKey(point, P256_CURVE)
        return true
    } catch {
        return false
    }
}

export function webPushSubscriptionRejection({
    endpoint,
    keys
}: WebPushSubscriptionClientData): string | undefined {
    if (endpoint.length > WEB_PUSH_ENDPOINT_MAX_LENGTH) {
        return 'endpoint is too long'
    }
    if (!URL.canParse(endpoint)) {
        return 'endpoint is not a URL'
    }
    const url = new URL(endpoint)
    if (url.protocol !== 'https:') {
        return 'endpoint must use https'
    }
    if (url.username !== '' || url.password !== '') {
        return 'endpoint must not carry credentials'
    }
    if (url.port !== '') {
        return 'endpoint must use the default https port'
    }
    if (!isSupportedPushServiceHost(url.hostname)) {
        return 'endpoint is not a supported push service'
    }
    const p256dh = Buffer.from(keys.p256dh, 'base64url')
    if (
        p256dh.length !== P256DH_UNCOMPRESSED_POINT_BYTES ||
        p256dh[0] !== P256DH_UNCOMPRESSED_POINT_PREFIX
    ) {
        return 'p256dh key is not an uncompressed P-256 point'
    }
    if (!isPointOnP256(p256dh)) {
        return 'p256dh key is not a point on the P-256 curve'
    }
    if (Buffer.from(keys.auth, 'base64url').length < AUTH_SECRET_MIN_BYTES) {
        return 'auth secret is too short'
    }
    return undefined
}

export function assertSupportedWebPushSubscription(data: WebPushSubscriptionClientData): void {
    const rejection = webPushSubscriptionRejection(data)
    if (rejection !== undefined) {
        throw new UnsupportedWebPushSubscriptionError(rejection)
    }
}
