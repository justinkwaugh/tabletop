import { expect, it } from 'vitest'
import { marketSourcesFirst } from './purchaseSources.js'

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
