import { createHmac } from 'node:crypto'
import { nanoid } from 'nanoid'

export const REALTIME_TOKEN_AUDIENCE = 'realtime'
export const REALTIME_TOKEN_LIFETIME_SECONDS = 60
const MINIMUM_KEY_BYTES = 32

export type RealtimeSigningKey = {
    kid: string
    key: Buffer
}

export function parseRealtimeSigningKey(raw: string): RealtimeSigningKey {
    const separator = raw.indexOf(':')
    const kid = raw.slice(0, separator)
    const key = Buffer.from(raw.slice(separator + 1), 'base64url')
    if (separator <= 0 || key.length < MINIMUM_KEY_BYTES) {
        throw new Error(
            `A realtime signing key is kid:base64url with at least ${MINIMUM_KEY_BYTES} key bytes`
        )
    }
    return { kid, key }
}

export class RealtimeTokenIssuer {
    constructor(
        private readonly signingKey: RealtimeSigningKey,
        private readonly now: () => number = Date.now,
        private readonly newTokenId: () => string = nanoid
    ) {}

    issue({ userId, topics }: { userId: string; topics: string[] }): string {
        const issuedAt = Math.floor(this.now() / 1000)
        const header = { alg: 'HS256', typ: 'JWT', kid: this.signingKey.kid }
        const payload = {
            sub: userId,
            topics,
            aud: REALTIME_TOKEN_AUDIENCE,
            iat: issuedAt,
            exp: issuedAt + REALTIME_TOKEN_LIFETIME_SECONDS,
            jti: this.newTokenId()
        }
        const signingInput = `${this.encode(header)}.${this.encode(payload)}`
        const signature = createHmac('sha256', this.signingKey.key)
            .update(signingInput)
            .digest('base64url')
        return `${signingInput}.${signature}`
    }

    private encode(value: object): string {
        return Buffer.from(JSON.stringify(value)).toString('base64url')
    }
}
