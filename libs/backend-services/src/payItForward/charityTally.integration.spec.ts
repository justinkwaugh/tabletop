import type { Firestore } from '@google-cloud/firestore'
import { Charity } from '@tabletop/common'
import { createClient, type RedisClientType } from 'redis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { FirestoreCharityTallyStore } from '../persistence/firestore/charityTallyStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { CharityTallyRefresher } from './charityTallyRefresher.js'
import { CHARITY_TALLY_CACHE_KEY, CharityTallyService } from './charityTallyService.js'

const SPEC_REDIS_DATABASE = 15

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Charity tally against Firestore and Redis',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let service: CharityTallyService
        let refresher: CharityTallyRefresher

        beforeEach(async () => {
            db = isolatedFirestore()
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false },
                database: SPEC_REDIS_DATABASE
            })
            await client.connect()
            await client.del(CHARITY_TALLY_CACHE_KEY)
            live = cacheFixture(client)
            const store = new FirestoreCharityTallyStore(db)
            service = new CharityTallyService(store, live.cache)
            refresher = new CharityTallyRefresher(
                {
                    getTeamCampaignTotal: async () => ({ amount: 25, currency: 'USD', open: true })
                },
                store,
                live.cache,
                async () => 1
            )
        })

        afterEach(async () => {
            await client.del(CHARITY_TALLY_CACHE_KEY)
            live.cache.destroy()
            client.destroy()
            await db.terminate()
        })

        it('replaces a cached absence with the first refreshed tally', async () => {
            expect(await service.getTally()).toBeUndefined()

            await refresher.refresh()

            expect(await service.getTally()).toMatchObject({
                totalUsd: 50,
                charities: [
                    { charity: Charity.GamersOutreach, amount: 25 },
                    { charity: Charity.SpecialEffect, amount: 25 }
                ]
            })
        })

        it('refills an emptied cache from Firestore', async () => {
            await refresher.refresh()
            await client.del(CHARITY_TALLY_CACHE_KEY)

            expect((await service.getTally())?.totalUsd).toBe(50)
        })
    }
)
