import { Charity } from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import { CharityTallyService } from './charityTallyService.js'
import type { TiltifyCampaignTotal } from './tiltifyApi.js'

const totals: Record<string, TiltifyCampaignTotal> = {
    '1aa404bd-38e9-4955-9178-4f52b63085ac': { amount: 820, currency: 'USD', open: true },
    '4f5b25b7-1a1a-4e50-a65b-c0831eeca686': { amount: 330, currency: 'GBP', open: false }
}

const passThroughCache = {
    cachingGet: async (_key: string, produce: () => Promise<unknown>) => await produce()
}

describe('CharityTallyService', () => {
    it('totals both campaigns in dollars and keeps each in its own currency', async () => {
        const service = new CharityTallyService(
            { getTeamCampaignTotal: async (id) => totals[id] },
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
        const getTeamCampaignTotal = vi.fn()
        const service = new CharityTallyService({ getTeamCampaignTotal }, cache, async () => 1)

        expect(await service.getTally()).toEqual({ totalUsd: 5, charities: [] })
        expect(cache.cachingGet).toHaveBeenCalledWith(
            'pay-it-forward-tally',
            expect.any(Function),
            3600
        )
        expect(getTeamCampaignTotal).not.toHaveBeenCalled()
    })
})
