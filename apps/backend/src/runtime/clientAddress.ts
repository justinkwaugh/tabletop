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
const firebaseHostingProxies = compileRanges(googleServiceRanges)

export function trustedProxyChain(service: string): TrustedProxy {
    const behindCloudRun = service !== 'local'
    return (address, hop) =>
        hop === 0 ? loopback(address) : hop === 1 && behindCloudRun && cloudRunIngress(address)
}

export function clientAddress(request: FastifyRequest): string {
    const ingressPeer = request.ip
    const claimed = request.headers['fastly-client-ip']
    if (claimed === undefined) return ingressPeer
    if (typeof claimed === 'string' && isIP(claimed) && firebaseHostingProxies(ingressPeer)) {
        return claimed
    }
    request.log.warn(
        { ingressPeer, claimed },
        'Ignoring Fastly-Client-IP that did not arrive through Firebase Hosting'
    )
    return ingressPeer
}
