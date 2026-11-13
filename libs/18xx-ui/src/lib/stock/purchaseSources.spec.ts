import { expect, it } from 'vitest'
import type { ShareCertificate } from '@tabletop/18xx'
import {
    distinctOwners,
    marketSourcesFirst,
    sameCertificateOffer,
    shareSourceName
} from './purchaseSources.js'

const source = (id: string, poolId?: string) => ({ id, certificate: { poolId } })
const ids = (sources: readonly { id: string }[]) => sources.map((source) => source.id)

it('lists the market first whichever pool holds the earliest certificate', () => {
    const treasury = source('treasury', 'treasury:NYC')
    const market = source('market', 'open-market')

    expect(ids(marketSourcesFirst([treasury, market], 'open-market'))).toEqual([
        'market',
        'treasury'
    ])
    expect(ids(marketSourcesFirst([market, treasury], 'open-market'))).toEqual([
        'market',
        'treasury'
    ])
})

it('keeps the listed order among the other sources and within the market', () => {
    const sources = [
        source('initial-offering', 'initial-offering'),
        source('company'),
        source('market-1', 'open-market'),
        source('market-2', 'open-market')
    ]

    expect(ids(marketSourcesFirst(sources, 'open-market'))).toEqual([
        'market-1',
        'market-2',
        'initial-offering',
        'company'
    ])
})

const bank = { kind: 'bank' } as const
const share = (fields: Partial<ShareCertificate> = {}): ShareCertificate => ({
    id: 'R-1',
    companyId: 'R',
    kind: 'share',
    shares: 1,
    owner: bank,
    poolId: 'market',
    ...fields
})

it('offers certificates alike in pool, number, size and presidency as one purchase', () => {
    expect(sameCertificateOffer(share({ id: 'R-1' }), share({ id: 'R-2' }))).toBe(true)
    for (const different of [
        share({ poolId: 'ipo' }),
        share({ number: 3 }),
        share({ shares: 2 }),
        share({ president: true }),
        share({ companyId: 'S' })
    ])
        expect(sameCertificateOffer(different, share())).toBe(false)
})

it('names a share by its pool, its company treasury or its holder', () => {
    const names = {
        poolName: (poolId: string) => (poolId === 'treasury:R' ? 'Treasury shares' : 'Market'),
        ownerName: () => 'Blair'
    }
    expect(shareSourceName(share(), names)).toBe('Market')
    expect(shareSourceName(share({ poolId: 'treasury:R' }), names)).toBe('Treasury')
    expect(
        shareSourceName(
            share({ poolId: undefined, owner: { kind: 'company', companyId: 'R' } }),
            names
        )
    ).toBe('Treasury')
    expect(
        shareSourceName(
            share({ poolId: undefined, owner: { kind: 'player', playerId: 'b' } }),
            names
        )
    ).toBe('Blair')
})

it('keeps the first of each owner in order', () => {
    const alex = { kind: 'player', playerId: 'a' } as const
    const unionBank = { kind: 'company', companyId: 'UB' } as const
    expect(distinctOwners([alex, unionBank, { ...alex }, unionBank])).toEqual([alex, unionBank])
})
