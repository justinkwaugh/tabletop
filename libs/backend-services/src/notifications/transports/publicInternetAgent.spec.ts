import https from 'node:https'
import net from 'node:net'
import type { Duplex } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BlockedDestinationError, DestinationDeadlineError } from '../notificationErrors.js'
import {
    type AddressResolver,
    isPublicInternetAddress,
    PublicInternetHttpsAgent
} from './publicInternetAgent.js'

function resolvingTo(addresses: string[]): AddressResolver {
    return (_hostname, _options, callback) =>
        callback(
            null,
            addresses.map((address) => ({ address, family: net.isIP(address) }))
        )
}

function lookupOf(agent: PublicInternetHttpsAgent): net.LookupFunction {
    const lookup = agent.options.lookup
    if (!lookup) throw new Error('agent has no lookup')
    return lookup
}

function requestError(options: https.RequestOptions): Promise<Error> {
    return new Promise((resolve, reject) => {
        const request = https.request(options, () => reject(new Error('request succeeded')))
        request.on('error', resolve)
        request.end()
    })
}

describe('public internet address classification', () => {
    it.each(['8.8.8.8', '142.250.72.206', '2a00:1450:4001:82f::200e', '::ffff:8.8.8.8', '1.1.1.1'])(
        'treats %s as public',
        (address) => {
            expect(isPublicInternetAddress(address)).toBe(true)
        }
    )

    it.each([
        '127.0.0.1',
        '127.255.255.254',
        '0.0.0.0',
        '10.1.2.3',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '192.0.0.1',
        '192.0.2.1',
        '198.18.0.1',
        '198.51.100.1',
        '203.0.113.1',
        '224.0.0.1',
        '240.0.0.1',
        '255.255.255.255',
        '::1',
        '::',
        '::ffff:127.0.0.1',
        '::ffff:7f00:1',
        '::ffff:10.0.0.1',
        '::ffff:169.254.169.254',
        '::127.0.0.1',
        '64:ff9b::7f00:1',
        '64:ff9b:1::a00:1',
        '2002:7f00:1::1',
        '2001:0:4136:e378:8000:63bf:3fff:fdd2',
        '2001:db8::1',
        '100::1',
        'fc00::1',
        'fd12:3456::1',
        'fe80::1',
        'fec0::1',
        'ff02::1',
        'not-an-address',
        'localhost'
    ])('refuses %s', (address) => {
        expect(isPublicInternetAddress(address)).toBe(false)
    })
})

describe('public internet https agent', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('hands the connection only the public addresses a hostname resolves to', async () => {
        const agent = new PublicInternetHttpsAgent({
            resolve: resolvingTo(['10.0.0.5', '142.250.72.206', '::1', '2a00:1450:4001:82f::200e'])
        })
        const result = await new Promise<unknown>((resolve) =>
            lookupOf(agent)('fcm.googleapis.com', { all: true }, (error, addresses) =>
                resolve(error ?? addresses)
            )
        )
        expect(result).toEqual([
            { address: '142.250.72.206', family: 4 },
            { address: '2a00:1450:4001:82f::200e', family: 6 }
        ])
        const single = await new Promise<unknown>((resolve) =>
            lookupOf(agent)('fcm.googleapis.com', {}, (error, address, family) =>
                resolve(error ?? [address, family])
            )
        )
        expect(single).toEqual(['142.250.72.206', 4])
    })

    it('refuses a hostname that resolves only to private addresses at connect time', async () => {
        const resolve = vi.fn(resolvingTo(['127.0.0.1', '10.0.0.5']))
        const agent = new PublicInternetHttpsAgent({ resolve })
        const error = await requestError({
            hostname: 'fcm.googleapis.com',
            path: '/fcm/send/token',
            method: 'POST',
            agent
        })
        expect(error).toBeInstanceOf(BlockedDestinationError)
        expect(error.message).toContain('127.0.0.1, 10.0.0.5')
        expect(resolve).toHaveBeenCalledWith(
            'fcm.googleapis.com',
            expect.objectContaining({ all: true }),
            expect.any(Function)
        )
    })

    it('passes resolver failures through', async () => {
        const failure: NodeJS.ErrnoException = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
            code: 'ENOTFOUND'
        })
        const agent = new PublicInternetHttpsAgent({
            resolve: (_hostname, _options, callback) => callback(failure, [])
        })
        const error = await requestError({ hostname: 'missing.example', path: '/', agent })
        expect(error).toBe(failure)
    })

    it('refuses IP literal destinations, which bypass hostname resolution', async () => {
        const resolve = vi.fn(resolvingTo(['142.250.72.206']))
        const agent = new PublicInternetHttpsAgent({ resolve })
        for (const hostname of ['169.254.169.254', '127.0.0.1', '::1', '::ffff:10.0.0.1']) {
            const error = await requestError({
                hostname,
                port: 8443,
                path: '/latest/meta-data/',
                agent
            })
            expect(error).toBeInstanceOf(BlockedDestinationError)
        }
        expect(resolve).not.toHaveBeenCalled()
    })

    it('destroys a connection that outlives its deadline', async () => {
        vi.useFakeTimers()
        const sockets: Duplex[] = []
        vi.spyOn(https.Agent.prototype, 'createConnection').mockImplementation(() => {
            const socket = new net.Socket()
            sockets.push(socket)
            return socket
        })
        const agent = new PublicInternetHttpsAgent({
            resolve: resolvingTo(['142.250.72.206']),
            connectionDeadlineMs: 5_000
        })
        const expired = agent.createConnection({ host: 'fcm.googleapis.com', port: 443 })
        const closed = agent.createConnection({ host: 'web.push.apple.com', port: 443 })
        expect(sockets).toEqual([expired, closed])
        const failures: Error[] = []
        const expiredFailure = new Promise<Error>((resolve) => expired?.once('error', resolve))
        for (const socket of sockets) socket.on('error', (error) => failures.push(error))
        closed?.destroy()
        vi.advanceTimersByTime(4_999)
        expect(expired?.destroyed).toBe(false)
        vi.advanceTimersByTime(1)
        expect(expired?.destroyed).toBe(true)
        const failure = await expiredFailure
        expect(failure).toBeInstanceOf(DestinationDeadlineError)
        expect(failure.message).toContain('fcm.googleapis.com')
        expect(failures).toEqual([failure])
    })
})
