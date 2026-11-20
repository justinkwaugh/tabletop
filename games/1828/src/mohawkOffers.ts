import {
    evaluatePrivateExchange,
    getCompany,
    privateExchangeOffers,
    sameOwner
} from '@tabletop/18xx'
import { bankPoolShares } from './merger.js'
import { inOperatingRound, mohawkDirectorships } from './mohawk.js'
import { noShareCompanyHasOperated } from './mohawkTiming.js'
import { IpoPoolId1828 } from './names.js'
import { PrivateRules1828 } from './operating.js'
import type { HydratedState1828 } from './state.js'
import { StockRules1828 } from './stock.js'
import { Market1828 } from './stockMarket.js'

/** A company floats with no more than this many of its shares left in the IPO (§7.4). */
const FloatingIpoShares = 4

export type MohawkShareOffer = {
    certificateId: string
    companyId: string
    poolId: string
    /** Whether taking it floats the company, and if so when that company first operates. */
    float?: 'now' | 'this-round' | 'next-round'
    becomesDirector: boolean
}

export type MohawkDirectorshipOffer = {
    companyId: string
    pars: { marketSpaceId: string; price: number }[]
}

export type MohawkOffers = {
    shares: MohawkShareOffer[]
    directorships: MohawkDirectorshipOffer[]
}

function floatTiming(state: HydratedState1828, companyId: string, poolId: string) {
    const company = getCompany(state, companyId)
    if (company.floated || poolId !== IpoPoolId1828) return undefined
    if (bankPoolShares(state, companyId, IpoPoolId1828) - 1 > FloatingIpoShares) return undefined
    if (!inOperatingRound(state)) return 'now'
    return noShareCompanyHasOperated(state) ? 'this-round' : 'next-round'
}

/** What the M&H's owner may take for it now (§13.2.2.6), each company and pool once. */
export function mohawkOffers(state: HydratedState1828, playerId: string): MohawkOffers {
    const owner = { kind: 'player', playerId } as const
    const seen = new Set<string>()
    const shares = privateExchangeOffers(state, playerId, PrivateRules1828, StockRules1828).flatMap(
        (request): MohawkShareOffer[] => {
            const certificate = state.certificates.find((item) => item.id === request.certificateId)
            if (certificate?.kind !== 'share' || !certificate.poolId) return []
            const { companyId, poolId } = certificate
            const key = `${companyId}:${poolId}`
            if (seen.has(key)) return []
            seen.add(key)
            const { details } = evaluatePrivateExchange(
                state,
                request,
                PrivateRules1828,
                StockRules1828
            )
            const float = floatTiming(state, companyId, poolId)
            return [
                {
                    certificateId: certificate.id,
                    companyId,
                    poolId,
                    ...(float ? { float } : {}),
                    becomesDirector:
                        !!details?.presidency && sameOwner(details.presidency.next, owner)
                }
            ]
        }
    )
    const directorships = mohawkDirectorships(state, playerId).map(
        ({ companyId, marketSpaceIds }) => ({
            companyId,
            pars: marketSpaceIds.map((marketSpaceId) => ({
                marketSpaceId,
                price: Market1828.space(marketSpaceId).price
            }))
        })
    )
    return { shares, directorships }
}
