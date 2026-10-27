import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRealtimeSigningKey, RealtimeTokenIssuer } from './realtimeTokenIssuer.js'

type TokenContract = {
    signingKey: string
    userId: string
    topics: string[]
    untilSeconds: Record<string, number>
    nowMillis: number
    tokenId: string
    token: string
}

const contract: TokenContract = JSON.parse(
    readFileSync(
        new URL('../../../../apps/realtime/testdata/token-contract.json', import.meta.url),
        'utf8'
    )
)

function decodePart(part: string): unknown {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

describe('RealtimeTokenIssuer', () => {
    it('signs exactly the token the realtime relay verifies in its contract test', () => {
        const issuer = new RealtimeTokenIssuer(
            parseRealtimeSigningKey(contract.signingKey),
            () => contract.nowMillis,
            () => contract.tokenId
        )
        const until = Object.fromEntries(
            Object.entries(contract.untilSeconds).map(([topic, seconds]) => [
                topic,
                new Date(seconds * 1000)
            ])
        )
        expect(issuer.issue({ userId: contract.userId, topics: contract.topics, until })).toBe(
            contract.token
        )
    })

    it('ends a bounded grant at the whole second before its end, and omits the claim without one', () => {
        const issuer = new RealtimeTokenIssuer(
            parseRealtimeSigningKey(contract.signingKey),
            () => 1_800_000_000_999,
            () => 'id-1'
        )
        const bounded = issuer
            .issue({
                userId: 'u2',
                topics: ['global', 'relay-stats'],
                until: { 'relay-stats': new Date(1_800_000_600_900) }
            })
            .split('.')[1]
        expect(decodePart(bounded)).toMatchObject({
            topics: ['global', 'relay-stats'],
            until: { 'relay-stats': 1_800_000_600 }
        })
        const plain = issuer.issue({ userId: 'u2', topics: ['global'], until: {} }).split('.')[1]
        expect(decodePart(plain)).not.toHaveProperty('until')
    })

    it('puts the key id in the header and a one-minute lifetime in the payload', () => {
        const issuer = new RealtimeTokenIssuer(
            parseRealtimeSigningKey(contract.signingKey),
            () => 1_800_000_000_999,
            () => 'id-1'
        )
        const [header, payload] = issuer.issue({ userId: 'u2', topics: ['global'] }).split('.')
        expect(decodePart(header)).toEqual({ alg: 'HS256', typ: 'JWT', kid: 'contract' })
        expect(decodePart(payload)).toEqual({
            sub: 'u2',
            topics: ['global'],
            aud: 'realtime',
            iat: 1_800_000_000,
            exp: 1_800_000_060,
            jti: 'id-1'
        })
    })

    it.each(['', 'nokid', ':c2hvcnQ', 'k1:c2hvcnQ'])('rejects the signing key %j', (raw) => {
        expect(() => parseRealtimeSigningKey(raw)).toThrow()
    })
})
