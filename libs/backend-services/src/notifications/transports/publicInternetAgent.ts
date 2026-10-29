import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { Duplex } from 'node:stream'
import { BlockedDestinationError, DestinationDeadlineError } from '../notificationErrors.js'

// IANA special-purpose IPv4 registry (RFC 6890) plus multicast and the reserved class E block
const SPECIAL_PURPOSE_IPV4: ReadonlyArray<readonly [string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
]

// IANA special-purpose IPv6 registry, including every prefix that embeds an IPv4 address
// (IPv4-compatible, NAT64, 6to4, Teredo); IPv4-mapped addresses are checked as IPv4 by BlockList
const SPECIAL_PURPOSE_IPV6: ReadonlyArray<readonly [string, number]> = [
    ['::', 96],
    ['64:ff9b::', 96],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['2001::', 32],
    ['2001:2::', 48],
    ['2001:10::', 28],
    ['2001:20::', 28],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['fec0::', 10],
    ['ff00::', 8]
]

const specialPurposeAddresses = new net.BlockList()
for (const [address, prefix] of SPECIAL_PURPOSE_IPV4) {
    specialPurposeAddresses.addSubnet(address, prefix, 'ipv4')
}
for (const [address, prefix] of SPECIAL_PURPOSE_IPV6) {
    specialPurposeAddresses.addSubnet(address, prefix, 'ipv6')
}

export function isPublicInternetAddress(address: string): boolean {
    const family = net.isIP(address)
    if (family === 0) {
        return false
    }
    return !specialPurposeAddresses.check(address, family === 6 ? 'ipv6' : 'ipv4')
}

export type AddressResolver = (
    hostname: string,
    options: dns.LookupAllOptions,
    callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
) => void

export const DEFAULT_REQUEST_DEADLINE_MS = 30_000

export type PublicInternetAgentOptions = https.AgentOptions & {
    resolve?: AddressResolver
    requestDeadlineMs?: number
}

// Node's HTTP client hands every request to its agent through addRequest, which @types/node leaves undeclared
declare module 'http' {
    interface Agent {
        addRequest(request: http.ClientRequest, options: http.RequestOptions): void
    }
}

export class PublicInternetHttpsAgent extends https.Agent {
    private readonly requestDeadlineMs: number

    constructor({
        resolve = dns.lookup,
        requestDeadlineMs = DEFAULT_REQUEST_DEADLINE_MS,
        ...agentOptions
    }: PublicInternetAgentOptions = {}) {
        super({ ...agentOptions, lookup: PublicInternetHttpsAgent.publicAddressLookup(resolve) })
        this.requestDeadlineMs = requestDeadlineMs
    }

    override addRequest(request: http.ClientRequest, options: http.RequestOptions): void {
        this.endRequestAfterDeadline(request)
        super.addRequest(request, options)
    }

    override createConnection(
        options: https.RequestOptions,
        callback?: (err: Error | null, stream: Duplex) => void
    ): Duplex | null | undefined {
        const hostname = options.host ?? options.hostname ?? ''
        if (net.isIP(hostname) !== 0 && !isPublicInternetAddress(hostname)) {
            return this.refusedSocket(
                new BlockedDestinationError({ hostname, addresses: [hostname] })
            )
        }
        return super.createConnection(options, callback)
    }

    private refusedSocket(error: Error): Duplex {
        const socket = new net.Socket()
        process.nextTick(() => socket.destroy(error))
        return socket
    }

    private endRequestAfterDeadline(request: http.ClientRequest) {
        const deadlineMs = this.requestDeadlineMs
        let timer: NodeJS.Timeout | undefined
        const armOnceActive = () => {
            timer = setTimeout(() => {
                request.destroy(
                    new DestinationDeadlineError({ hostname: request.host, deadlineMs })
                )
            }, deadlineMs)
            timer.unref()
        }
        request.once('socket', armOnceActive)
        request.once('close', () => {
            request.off('socket', armOnceActive)
            clearTimeout(timer)
        })
    }

    private static publicAddressLookup(resolve: AddressResolver): net.LookupFunction {
        return (hostname, options, callback) => {
            resolve(hostname, { ...options, all: true }, (error, addresses) => {
                if (error) {
                    callback(error, [])
                    return
                }
                const publicAddresses = addresses.filter((entry) =>
                    isPublicInternetAddress(entry.address)
                )
                if (publicAddresses.length === 0) {
                    callback(
                        new BlockedDestinationError({
                            hostname,
                            addresses: addresses.map((entry) => entry.address)
                        }),
                        []
                    )
                    return
                }
                if (options.all) {
                    callback(null, publicAddresses)
                } else {
                    callback(null, publicAddresses[0].address, publicAddresses[0].family)
                }
            })
        }
    }
}
