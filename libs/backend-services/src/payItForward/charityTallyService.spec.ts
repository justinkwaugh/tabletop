import { Charity, type CharityTally } from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import { CharityTallyService } from './charityTallyService.js'

const tally: CharityTally = {
    totalUsd: 820,
    charities: [
        { charity: Charity.GamersOutreach, amount: 820, currency: 'USD', campaignOpen: true }
    ]
}

const passThroughCache = {
    cachingGet: vi.fn(async (_key: string, produce: () => Promise<unknown>) => await produce())
}

describe('CharityTallyService', () => {
    it('reads the stored tally through the cache', async () => {
        const service = new CharityTallyService({ findTally: async () => tally }, passThroughCache)

        expect(await service.getTally()).toEqual(tally)
        expect(passThroughCache.cachingGet).toHaveBeenCalledWith(
            'pay-it-forward-tally',
            expect.any(Function)
        )
    })

    it('has no tally before the first refresh', async () => {
        const service = new CharityTallyService(
            { findTally: async () => undefined },
            passThroughCache
        )
        expect(await service.getTally()).toBeUndefined()
    })

    it('serves a cached tally without reading the store', async () => {
        const findTally = vi.fn()
        const service = new CharityTallyService({ findTally }, { cachingGet: async () => tally })
        expect(await service.getTally()).toEqual(tally)
        expect(findTally).not.toHaveBeenCalled()
    })
})
