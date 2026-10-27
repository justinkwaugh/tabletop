import { afterAll, describe, expect, it } from 'vitest'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreAuthenticationChallengeStore } from './authenticationChallengeStore.js'
import type { AuthenticationChallengeRecord } from '../../challenges/authenticationChallenge.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
    'Authentication challenges in the Firestore challenge store',
    { timeout: 15_000 },
    () => {
        const firestore = isolatedFirestore()
        const store = new FirestoreAuthenticationChallengeStore(firestore)
        let sequence = 0

        afterAll(async () => {
            await firestore.terminate()
        })

        function newRecord(secretHash = 'hash-1'): {
            key: string
            record: AuthenticationChallengeRecord
        } {
            const userId = `account-${sequence++}`
            return {
                key: `set-password:${userId}`,
                record: {
                    purpose: 'set-password',
                    userId,
                    email: `${userId}@example.test`,
                    secretHash,
                    expiresAt: new Date('2026-10-27T12:15:00.000Z')
                }
            }
        }

        async function consume(key: string) {
            return firestore.runTransaction(async (transaction) => {
                const record = await store.find(transaction, key)
                if (record) store.delete(transaction, key)
                return record
            })
        }

        it('returns the stored record with its date and deletes it inside the transaction', async () => {
            const { key, record } = newRecord()
            await store.replace(key, record)
            await expect(consume(key)).resolves.toEqual(record)
            await expect(consume(key)).resolves.toBeUndefined()
        })

        it('overwrites the earlier challenge of the same Account and purpose', async () => {
            const { key, record } = newRecord('hash-first')
            await store.replace(key, record)
            await store.replace(key, { ...record, secretHash: 'hash-second' })
            const stored = await firestore
                .collection('authenticationChallenges')
                .where('userId', '==', record.userId)
                .get()
            expect(stored.size).toBe(1)
            await expect(consume(key)).resolves.toMatchObject({ secretHash: 'hash-second' })
        })

        it('hands a concurrently presented challenge to exactly one consumer', async () => {
            const { key, record } = newRecord()
            await store.replace(key, record)
            const outcomes = await Promise.all([consume(key), consume(key), consume(key)])
            expect(outcomes.filter((outcome) => outcome !== undefined)).toHaveLength(1)
        })

        it('stores a sensitive change operation exactly as issued', async () => {
            const record: AuthenticationChallengeRecord = {
                purpose: 'sensitive-change',
                userId: 'account-op',
                email: 'op@example.test',
                operation: { email: 'next@example.test', password: true },
                secretHash: 'hash-op',
                expiresAt: new Date('2026-10-27T12:15:00.000Z')
            }
            await store.replace('sensitive-change:account-op', record)
            await expect(consume('sensitive-change:account-op')).resolves.toEqual(record)
        })
    }
)
