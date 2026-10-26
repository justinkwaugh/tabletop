import { Charity } from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import { CharityTallyService } from './charityTallyService.js'
import type { TiltifyCampaignTotal } from './tiltifyApi.js'

const totals: Record<string, TiltifyCampaignTotal> = {
    'f5513dae-a6f9-4eb5-942b-df33f2871f73': { amount: 820, currency: 'USD', retired: false },
    '908648d6-4cfa-4d83-844d-538822d881c8': { amount: 330, currency: 'GBP', retired: true }
}

const passThroughCache = {
    cachingGet: async (_key: string, produce: () => Promise<unknown>) => await produce()
}

describe('CharityTallyService', () => {
    it('totals both campaigns in dollars and keeps each in its own currency', async () => {
        const service = new CharityTallyService(
            { getCampaignTotal: async (id) => totals[id] },
            passThroughCache,
            async (currency) => (currency === 'GBP' ? 1.3348 : 1)
        )

        const tally = await service.getTally()

        expect(tally).toEqual({
            totalUsd: 1260.48,
            charities: [
                {
                    charity: Charity.GamersOutreach,
                    amount: 820,
                    currency: 'USD',
                    campaignOpen: true
                },
                {
                    charity: Charity.SpecialEffect,
                    amount: 330,
                    currency: 'GBP',
                    campaignOpen: false
                }
            ]
        })
    })

    it('serves the tally from the hourly cache', async () => {
        const cache = { cachingGet: vi.fn(async () => ({ totalUsd: 5, charities: [] })) }
        const getCampaignTotal = vi.fn()
        const service = new CharityTallyService({ getCampaignTotal }, cache, async () => 1)

        expect(await service.getTally()).toEqual({ totalUsd: 5, charities: [] })
        expect(cache.cachingGet).toHaveBeenCalledWith(
            'pay-it-forward-tally',
            expect.any(Function),
            3600
        )
        expect(getCampaignTotal).not.toHaveBeenCalled()
    })
})
