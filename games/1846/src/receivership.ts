import { assert } from '@tabletop/common'
import {
    finiteCashOwnedBy,
    sameOwner,
    inReceivership,
    operatingPlayerIds,
    type ReceivershipRules
} from '@tabletop/18xx'
import { Market1846 } from './stock.js'

/**
 * GMT §8: every surviving player runs a receiver's trains, it withholds and buys the cheapest
 * train it can afford, and a 10% holder takes the presidency back by buying half the
 * president's certificate from the market when no other share of it is there.
 */
export const ReceivershipRules1846: ReceivershipRules = {
    operators: (state) => [...state.turnManager.turnOrder],
    presidencyClaim(state, companyId, buyer) {
        const certificates = state.certificates.filter(
            (certificate) => certificate.companyId === companyId
        )
        if (
            certificates.some(
                (certificate) =>
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    certificate.poolId === 'open-market'
            )
        )
            return undefined
        const president = certificates.find(
            (certificate) => certificate.kind === 'share' && certificate.president
        )
        const ordinary = certificates.filter(
            (certificate) =>
                certificate.kind === 'share' &&
                !certificate.president &&
                sameOwner(certificate.owner, buyer)
        )
        if (!president || ordinary.length !== 1) return undefined
        const price = Market1846.companySpace(state.stockMarket, companyId).price
        if (price <= 0 || finiteCashOwnedBy(state, buyer) < price) return undefined
        return {
            price,
            claim: {
                companyId,
                next: buyer,
                presidentCertificateId: president.id,
                exchangedCertificateIds: [ordinary[0].id],
                poolId: 'open-market'
            }
        }
    }
}

export function operatingPlayers1846(
    state: Parameters<typeof operatingPlayerIds>[0],
    companyId: string
): string[] {
    const players = operatingPlayerIds(state, companyId, ReceivershipRules1846)
    assert(players.length > 0, 'An operated corporation requires a president or receivership')
    return players
}
export { inReceivership }
