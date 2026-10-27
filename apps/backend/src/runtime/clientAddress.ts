import { isIP } from 'node:net'
import type { FastifyRequest } from 'fastify'
import ipaddr from 'ipaddr.js'
import { googleServiceRanges } from './googleServiceRanges.js'

export type TrustedProxy = (address: string, hop: number) => boolean

type AddressRange = [ipaddr.IPv4 | ipaddr.IPv6, number]

function compileRanges(notations: readonly string[]): (address: string) => boolean {
    const ranges: AddressRange[] = notations.map((notation) => ipaddr.parseCIDR(notation))
    return (address) => {
        if (!isIP(address)) return false
        const parsed = ipaddr.process(address)
        return ranges.some(
            (range) => range[0].kind() === parsed.kind() && parsed.match(range[0], range[1])
        )
    }
}

const loopback = compileRanges(['127.0.0.0/8', '::1/128'])
const cloudRunIngress = compileRanges(['169.254.0.0/16', 'fe80::/10'])
export const isGoogleServicePeer = compileRanges(googleServiceRanges)

export function trustedProxyChain(service: string): TrustedProxy {
    const behindCloudRun = service !== 'local'
    return (address, hop) =>
        hop === 0 ? loopback(address) : hop === 1 && behindCloudRun && cloudRunIngress(address)
}

export type ClientAttribution = 'ingress-peer' | 'hosting-hint'

export interface ClientIdentity {
    readonly ingressPeer: string
    readonly client: string
    readonly attribution: ClientAttribution
}

// A Google service address is where Firebase Hosting rewrites arrive from, but any Google-hosted
// fetcher shares those ranges, so the forwarded client address is a hint for attribution only.
export function clientIdentity(request: FastifyRequest): ClientIdentity {
    const ingressPeer = request.ip
    const claimed = request.headers['fastly-client-ip']
    const peerIdentity: ClientIdentity = {
        ingressPeer,
        client: ingressPeer,
        attribution: 'ingress-peer'
    }
    if (claimed === undefined) return peerIdentity
    if (typeof claimed === 'string' && isIP(claimed) && isGoogleServicePeer(ingressPeer)) {
        return { ingressPeer, client: claimed, attribution: 'hosting-hint' }
    }
    request.log.warn(
        { ingressPeer, claimed },
        'Ignoring Fastly-Client-IP that did not arrive from a Google service address'
    )
    return peerIdentity
}
