import { Charity } from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import type { StoredCharityTally } from '../persistence/model/storedCharityTally.js'
import { CharityTallyRefresher } from './charityTallyRefresher.js'
import type { TiltifyCampaignTotal } from './tiltifyApi.js'

const totals: Record<string, TiltifyCampaignTotal> = {
    '1aa404bd-38e9-4955-9178-4f52b63085ac': { amount: 820, currency: 'USD', open: true },
    '4f5b25b7-1a1a-4e50-a65b-c0831eeca686': { amount: 330, currency: 'GBP', open: false }
}

function refresher({
    usdPerUnit = async (currency: string) => (currency === 'GBP' ? 1.3348 : 1),
    getTeamCampaignTotal = async (id: string) => totals[id]
}: {
    usdPerUnit?: (currency: string) => Promise<number>
    getTeamCampaignTotal?: (id: string) => Promise<TiltifyCampaignTotal>
} = {}) {
    const saveTally = vi.fn(async (_record: StoredCharityTally) => undefined)
    const set = vi.fn(async (_key: string, _value: unknown) => undefined)
    const instance = new CharityTallyRefresher(
        { getTeamCampaignTotal },
        { saveTally },
        { set },
        usdPerUnit,
        () => new Date('2026-10-26T21:00:00Z')
    )
    return { instance, saveTally, set }
}

describe('CharityTallyRefresher', () => {
    it('totals both campaigns in dollars, stores the result and caches it', async () => {
        const { instance, saveTally, set } = refresher()

        const tally = await instance.refresh()

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
        expect(saveTally).toHaveBeenCalledWith({
            tally,
            usdPerUnit: { USD: 1, GBP: 1.3348 },
            refreshedAt: '2026-10-26T21:00:00.000Z'
        })
        expect(set).toHaveBeenCalledWith('pay-it-forward-tally', tally)
    })

    it('keeps the last good tally when a source fails', async () => {
        const { instance, saveTally, set } = refresher({
            usdPerUnit: async () => {
                throw new Error('rates unavailable')
            }
        })

        await expect(instance.refresh()).rejects.toThrow('rates unavailable')
        expect(saveTally).not.toHaveBeenCalled()
        expect(set).not.toHaveBeenCalled()
    })
})
