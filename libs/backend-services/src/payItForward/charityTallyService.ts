import { Charity, CharityTally, type CharityRaised } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { MissedValueProducer } from '../cache/cacheService.js'
import type { TiltifyApi } from './tiltifyApi.js'
import { fetchUsdPerUnit } from './exchangeRates.js'

const TALLY_CACHE_KEY = 'pay-it-forward-tally'
const TALLY_CACHE_SECONDS = 60 * 60

type TallyCache = {
    cachingGet(key: string, produce: MissedValueProducer, forSeconds: number): Promise<unknown>
}

const TILTIFY_TEAM_CAMPAIGNS: Record<Charity, string> = {
    [Charity.GamersOutreach]: '1aa404bd-38e9-4955-9178-4f52b63085ac',
    [Charity.SpecialEffect]: '4f5b25b7-1a1a-4e50-a65b-c0831eeca686'
}

export class CharityTallyService {
    constructor(
        private readonly tiltify: Pick<TiltifyApi, 'getTeamCampaignTotal'>,
        private readonly cache: TallyCache,
        private readonly usdPerUnit: (currency: string) => Promise<number> = fetchUsdPerUnit
    ) {}

    async getTally(): Promise<CharityTally> {
        const tally = await this.cache.cachingGet(
            TALLY_CACHE_KEY,
            () => this.fetchTally(),
            TALLY_CACHE_SECONDS
        )
        Value.Assert(CharityTally, tally)
        return tally
    }

    private async fetchTally(): Promise<CharityTally> {
        const charities = await Promise.all(
            Object.values(Charity).map((charity) => this.fetchRaised(charity))
        )
        const usdAmounts = await Promise.all(
            charities.map(
                async ({ amount, currency }) => amount * (await this.usdPerUnit(currency))
            )
        )
        const totalUsd = usdAmounts.reduce((sum, amount) => sum + amount, 0)
        return { totalUsd: Math.round(totalUsd * 100) / 100, charities }
    }

    private async fetchRaised(charity: Charity): Promise<CharityRaised> {
        const total = await this.tiltify.getTeamCampaignTotal(TILTIFY_TEAM_CAMPAIGNS[charity])
        return {
            charity,
            amount: total.amount,
            currency: total.currency,
            campaignOpen: total.open
        }
    }
}
