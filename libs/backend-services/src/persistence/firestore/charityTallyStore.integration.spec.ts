import { Charity } from '@tabletop/common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Firestore } from '@google-cloud/firestore'
import { FirestoreCharityTallyStore } from './charityTallyStore.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Charity tally in Firestore', () => {
    let db: Firestore
    let store: FirestoreCharityTallyStore

    beforeEach(() => {
        db = isolatedFirestore()
        store = new FirestoreCharityTallyStore(db)
    })

    afterEach(async () => {
        await db.terminate()
    })

    it('has nothing before the first save', async () => {
        expect(await store.findTally()).toBeUndefined()
    })

    it('returns the latest saved tally', async () => {
        const tally = {
            totalUsd: 12.5,
            charities: [
                {
                    charity: Charity.GamersOutreach,
                    amount: 12.5,
                    currency: 'USD',
                    campaignOpen: true
                }
            ]
        }
        await store.saveTally({
            tally: { totalUsd: 1, charities: [] },
            usdPerUnit: { USD: 1 },
            refreshedAt: '2026-10-26T20:00:00.000Z'
        })
        await store.saveTally({
            tally,
            usdPerUnit: { USD: 1 },
            refreshedAt: '2026-10-26T20:15:00.000Z'
        })
        expect(await store.findTally()).toEqual(tally)
    })
})
