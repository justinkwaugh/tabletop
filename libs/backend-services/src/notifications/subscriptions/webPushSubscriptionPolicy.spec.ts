import { describe, expect, it } from 'vitest'
import { UnsupportedWebPushSubscriptionError } from '../notificationErrors.js'
import {
    APPLE_ENDPOINT,
    CHROME_CANARY_ENDPOINT,
    FCM_ENDPOINT,
    MOZILLA_ENDPOINT,
    OFF_CURVE_P256DH,
    WNS_ENDPOINT,
    webPushClientData,
    webPushKeys
} from '../tests/webPushFixtures.js'
import {
    assertSupportedWebPushSubscription,
    isSupportedPushServiceHost,
    webPushSubscriptionRejection
} from './webPushSubscriptionPolicy.js'

describe('web push subscription policy', () => {
    it.each([FCM_ENDPOINT, MOZILLA_ENDPOINT, APPLE_ENDPOINT, WNS_ENDPOINT, CHROME_CANARY_ENDPOINT])(
        'accepts a supported browser push service endpoint %s',
        (endpoint) => {
            expect(webPushSubscriptionRejection(webPushClientData(endpoint))).toBeUndefined()
        }
    )

    it('accepts a supported host regardless of letter case and an explicit default port', () => {
        expect(
            webPushSubscriptionRejection(
                webPushClientData('https://FCM.GoogleAPIs.com:443/fcm/send/token')
            )
        ).toBeUndefined()
    })

    it.each([
        ['https://127.0.0.1:8443/internal', 'endpoint must use the default https port'],
        ['https://127.0.0.1/internal', 'endpoint is not a supported push service'],
        ['https://[::1]/internal', 'endpoint is not a supported push service'],
        ['https://[::ffff:127.0.0.1]/internal', 'endpoint is not a supported push service'],
        ['https://[64:ff9b::7f00:1]/internal', 'endpoint is not a supported push service'],
        ['https://169.254.169.254/latest/meta-data/', 'endpoint is not a supported push service'],
        ['https://0x7f000001/internal', 'endpoint is not a supported push service'],
        ['https://2130706433/internal', 'endpoint is not a supported push service'],
        ['https://localhost/internal', 'endpoint is not a supported push service'],
        [
            'https://metadata.google.internal/computeMetadata/v1/',
            'endpoint is not a supported push service'
        ],
        ['http://fcm.googleapis.com/fcm/send/token', 'endpoint must use https'],
        ['ftp://fcm.googleapis.com/fcm/send/token', 'endpoint must use https'],
        [
            'https://fcm.googleapis.com:8443/fcm/send/token',
            'endpoint must use the default https port'
        ],
        [
            'https://user:pass@fcm.googleapis.com/fcm/send/token',
            'endpoint must not carry credentials'
        ],
        [
            'https://fcm.googleapis.com@evil.test/fcm/send/token',
            'endpoint must not carry credentials'
        ],
        [
            'https://fcm.googleapis.com.evil.test/fcm/send/token',
            'endpoint is not a supported push service'
        ],
        [
            'https://fcm.googleapis.com%2eevil.test/fcm/send/token',
            'endpoint is not a supported push service'
        ],
        [
            'https://evil-fcm.googleapis.com/fcm/send/token',
            'endpoint is not a supported push service'
        ],
        ['https://fcm.googleapis.com./fcm/send/token', 'endpoint is not a supported push service'],
        ['https://notify.windows.com/w/?token=t', 'endpoint is not a supported push service'],
        [
            'https://evil.test.notify.windows.com/w/?token=t',
            'endpoint is not a supported push service'
        ],
        [
            'https://notify.windows.com.evil.test/w/?token=t',
            'endpoint is not a supported push service'
        ],
        [
            'https://wns2-db5p.notify.windows.com.evil.test/w/',
            'endpoint is not a supported push service'
        ],
        ['https://xn--fcm-googleapis-com.evil.test/', 'endpoint is not a supported push service'],
        ['not a url', 'endpoint is not a URL'],
        ['', 'endpoint is not a URL']
    ])('rejects %s', (endpoint, reason) => {
        expect(webPushSubscriptionRejection(webPushClientData(endpoint))).toBe(reason)
    })

    it('rejects an endpoint longer than the stored bound', () => {
        const endpoint = `${FCM_ENDPOINT}/${'a'.repeat(2048)}`
        expect(webPushSubscriptionRejection(webPushClientData(endpoint))).toBe(
            'endpoint is too long'
        )
    })

    it('rejects keys the push encryption could not use', () => {
        const keys = webPushKeys()
        expect(
            webPushSubscriptionRejection({
                endpoint: FCM_ENDPOINT,
                keys: { ...keys, p256dh: 'AAAA' }
            })
        ).toBe('p256dh key is not an uncompressed P-256 point')
        const compressed = Buffer.from(keys.p256dh, 'base64url')
        compressed[0] = 0x02
        expect(
            webPushSubscriptionRejection({
                endpoint: FCM_ENDPOINT,
                keys: { ...keys, p256dh: compressed.toString('base64url') }
            })
        ).toBe('p256dh key is not an uncompressed P-256 point')
        expect(
            webPushSubscriptionRejection({
                endpoint: FCM_ENDPOINT,
                keys: { ...keys, auth: Buffer.alloc(15).toString('base64url') }
            })
        ).toBe('auth secret is too short')
        expect(
            webPushSubscriptionRejection({
                endpoint: FCM_ENDPOINT,
                keys: { ...keys, auth: Buffer.alloc(32).toString('base64url') }
            })
        ).toBeUndefined()
    })

    it('rejects a well-formed p256dh key whose coordinates are not on the P-256 curve', () => {
        const keys = webPushKeys()
        expect(
            webPushSubscriptionRejection({
                endpoint: FCM_ENDPOINT,
                keys: { ...keys, p256dh: OFF_CURVE_P256DH }
            })
        ).toBe('p256dh key is not a point on the P-256 curve')
        const offByOne = Buffer.from(keys.p256dh, 'base64url')
        offByOne[64] ^= 0x01
        expect(
            webPushSubscriptionRejection({
                endpoint: FCM_ENDPOINT,
                keys: { ...keys, p256dh: offByOne.toString('base64url') }
            })
        ).toBe('p256dh key is not a point on the P-256 curve')
        expect(webPushSubscriptionRejection({ endpoint: FCM_ENDPOINT, keys })).toBeUndefined()
    })

    it('matches push service hosts on whole labels only', () => {
        expect(isSupportedPushServiceHost('wns2-am3p.notify.windows.com')).toBe(true)
        expect(isSupportedPushServiceHost('web.push.apple.com')).toBe(true)
        expect(isSupportedPushServiceHost('push.apple.com')).toBe(false)
        expect(isSupportedPushServiceHost('a.b.notify.windows.com')).toBe(false)
        expect(isSupportedPushServiceHost('xnotify.windows.com')).toBe(false)
        expect(isSupportedPushServiceHost('.notify.windows.com')).toBe(false)
    })

    it('throws a client error carrying the reason', () => {
        expect(() =>
            assertSupportedWebPushSubscription(webPushClientData('https://10.0.0.5/hook'))
        ).toThrow(UnsupportedWebPushSubscriptionError)
        expect(() =>
            assertSupportedWebPushSubscription(webPushClientData('https://10.0.0.5/hook'))
        ).toThrow('endpoint is not a supported push service')
        expect(() =>
            assertSupportedWebPushSubscription(webPushClientData(FCM_ENDPOINT))
        ).not.toThrow()
    })
})
