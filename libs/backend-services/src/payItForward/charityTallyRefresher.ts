import { Charity, type CharityRaised, type CharityTally } from '@tabletop/common'
import type { RedisCacheService } from '../cache/cacheService.js'
import type { CharityTallyStore } from '../persistence/stores/charityTallyStore.js'
import { CHARITY_TALLY_CACHE_KEY } from './charityTallyService.js'
import { fetchUsdPerUnit } from './exchangeRates.js'
import type { TiltifyApi } from './tiltifyApi.js'

const TILTIFY_TEAM_CAMPAIGNS: Record<Charity, string> = {
    [Charity.GamersOutreach]: '1aa404bd-38e9-4955-9178-4f52b63085ac',
    [Charity.SpecialEffect]: '4f5b25b7-1a1a-4e50-a65b-c0831eeca686'
}

export class CharityTallyRefresher {
    constructor(
        private readonly tiltify: Pick<TiltifyApi, 'getTeamCampaignTotal'>,
        private readonly store: Pick<CharityTallyStore, 'saveTally'>,
        private readonly cache: Pick<RedisCacheService, 'set'>,
        private readonly usdPerUnit: (currency: string) => Promise<number> = fetchUsdPerUnit,
        private readonly now: () => Date = () => new Date()
    ) {}

    async refresh(): Promise<CharityTally> {
        const charities = await Promise.all(
            Object.values(Charity).map((charity) => this.fetchRaised(charity))
        )
        const usdPerUnit = await this.fetchUsdRates(charities)
        const totalUsd = charities.reduce(
            (sum, { amount, currency }) => sum + amount * usdPerUnit[currency],
            0
        )
        const tally: CharityTally = { totalUsd: Math.round(totalUsd * 100) / 100, charities }
        await this.store.saveTally({ tally, usdPerUnit, refreshedAt: this.now().toISOString() })
        await this.cache.set(CHARITY_TALLY_CACHE_KEY, tally)
        console.log(`Charity tally refresh ${JSON.stringify({ ...tally, usdPerUnit })}`)
        return tally
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

    private async fetchUsdRates(charities: CharityRaised[]): Promise<Record<string, number>> {
        const currencies = [...new Set(charities.map(({ currency }) => currency))]
        const rates = await Promise.all(currencies.map((currency) => this.usdPerUnit(currency)))
        return Object.fromEntries(currencies.map((currency, index) => [currency, rates[index]]))
    }
}
