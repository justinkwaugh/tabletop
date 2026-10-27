import { CharityTally } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { CachingReader } from '../cache/cacheService.js'
import type { CharityTallyStore } from '../persistence/stores/charityTallyStore.js'

export const CHARITY_TALLY_CACHE_KEY = 'pay-it-forward-tally'

export class CharityTallyService {
    constructor(
        private readonly store: Pick<CharityTallyStore, 'findTally'>,
        private readonly cache: CachingReader
    ) {}

    async getTally(): Promise<CharityTally | undefined> {
        const tally = await this.cache.cachingGet(CHARITY_TALLY_CACHE_KEY, () =>
            this.store.findTally()
        )
        if (tally === undefined) return undefined
        Value.Assert(CharityTally, tally)
        return tally
    }
}
