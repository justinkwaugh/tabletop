import { afterAll, describe, expect, it } from 'vitest'
import { ExternalAuthService } from '@tabletop/common'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreOAuthStateStore } from './oauthStateStore.js'
import { secretReference } from '../../security/secretReference.js'
import { errorText } from './tests/errorText.js'
import type { OAuthStateRecord } from '../../oauth/oauthState.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
    'OAuth states in the Firestore state store',
    { timeout: 15_000 },
    () => {
        const firestore = isolatedFirestore()
        const store = new FirestoreOAuthStateStore(firestore)
        let sequence = 0

        afterAll(async () => {
            await firestore.terminate()
        })

        function newRecord(): OAuthStateRecord {
            return {
                state: `link.state-${sequence++}`,
                provider: ExternalAuthService.Discord,
                purpose: 'link',
                redirectUri: 'https://site.test/oauth/discord/link',
                binding: { kind: 'session', sessionId: 'session-1', userId: 'account-1' },
                expiresAt: new Date('2026-10-27T12:10:00.000Z')
            }
        }

        it('returns the stored record with its date exactly once', async () => {
            const record = newRecord()
            await store.create(record)
            await expect(store.consume(record.state)).resolves.toEqual(record)
            await expect(store.consume(record.state)).resolves.toBeUndefined()
            const snapshot = await firestore.collection('oauthStates').doc(record.state).get()
            expect(snapshot.exists).toBe(false)
        })

        it('hands a concurrently presented state to exactly one consumer', async () => {
            const record = newRecord()
            await store.create(record)
            const outcomes = await Promise.all(
                Array.from({ length: 6 }, () => store.consume(record.state))
            )
            expect(outcomes.filter((outcome) => outcome !== undefined)).toHaveLength(1)
        })

        it('refuses to issue the same state twice and reports it only by reference', async () => {
            const record = newRecord()
            await store.create(record)
            const failure = await store.create(record).catch((error: unknown) => error)
            expect(failure).toBeInstanceOf(Error)
            if (!(failure instanceof Error)) throw new Error('unexpected')
            expect(failure.name).toBe('AlreadyExistsError')
            expect(errorText(failure)).toContain(secretReference(record.state))
            expect(errorText(failure)).not.toContain(record.state)
        })

        it('treats an unknown or invalid state as nothing to consume', async () => {
            await expect(store.consume('login.never-issued')).resolves.toBeUndefined()
            await expect(store.consume('../escape')).resolves.toBeUndefined()
        })
    }
)
