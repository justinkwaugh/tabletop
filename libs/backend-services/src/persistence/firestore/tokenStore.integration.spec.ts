import { afterAll, describe, expect, it } from 'vitest'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreTokenStore } from './tokenStore.js'
import { TokenType, type DataToken } from '../../tokens/dataToken.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
    'Data tokens in the shared Firestore token store',
    { timeout: 15_000 },
    () => {
        const firestore = isolatedFirestore()
        const store = new FirestoreTokenStore(firestore)
        let sequence = 0

        afterAll(async () => {
            await firestore.terminate()
        })

        function newToken(secretHash = 'hash-1'): DataToken {
            const userId = `account-${sequence++}`
            return {
                id: `${TokenType.PasswordReset}:${userId}`,
                type: TokenType.PasswordReset,
                expiration: new Date('2026-10-27T12:15:00.000Z'),
                data: { userId, email: `${userId}@example.test`, secretHash }
            }
        }

        async function consume(key: string) {
            return firestore.runTransaction(async (transaction) => {
                const token = await store.find(key, transaction)
                if (token) await store.delete(key, transaction)
                return token
            })
        }

        it('reads dates and payloads through the existing nontransactional interface', async () => {
            const token = {
                ...newToken(),
                id: 'random-invitation-secret',
                type: TokenType.GameInvitation
            }
            await store.create(token)
            await expect(store.find(token.id)).resolves.toMatchObject(token)
            await store.delete(token.id)
            await expect(store.find(token.id)).resolves.toBeUndefined()
        })

        it('reads and deletes a token inside the caller transaction', async () => {
            const token = newToken()
            await store.replace(token)
            await expect(consume(token.id)).resolves.toMatchObject(token)
            await expect(consume(token.id)).resolves.toBeUndefined()
        })

        it('replaces the earlier token in the same collection without touching other types', async () => {
            const token = newToken('hash-first')
            const invitation = {
                ...newToken(),
                id: 'another-invitation',
                type: TokenType.GameInvitation
            }
            await store.create(invitation)
            await store.replace(token)
            const replacement = { ...token, data: { ...token.data, secretHash: 'hash-second' } }
            await store.replace(replacement)
            const stored = await firestore.collection('tokens').where('id', '==', token.id).get()
            expect(stored.size).toBe(1)
            await expect(consume(token.id)).resolves.toMatchObject(replacement)
            await expect(store.find(invitation.id)).resolves.toMatchObject(invitation)
        })

        it('hands a concurrently presented token to exactly one consumer', async () => {
            const token = newToken()
            await store.replace(token)
            const outcomes = await Promise.all([
                consume(token.id),
                consume(token.id),
                consume(token.id)
            ])
            expect(outcomes.filter((outcome) => outcome !== undefined)).toHaveLength(1)
        })

        it('keeps the token if the caller transaction aborts after scheduling its deletion', async () => {
            const token = newToken()
            await store.replace(token)
            await expect(
                firestore.runTransaction(async (transaction) => {
                    await store.find(token.id, transaction)
                    await store.delete(token.id, transaction)
                    throw new Error('synthetic account write failure')
                })
            ).rejects.toThrow('synthetic account write failure')
            await expect(store.find(token.id)).resolves.toMatchObject(token)
        })

        it('stores the sensitive change payload exactly as issued', async () => {
            const token: DataToken = {
                id: `${TokenType.SensitiveChange}:account-op`,
                type: TokenType.SensitiveChange,
                expiration: new Date('2026-10-27T12:15:00.000Z'),
                data: {
                    userId: 'account-op',
                    email: 'op@example.test',
                    operation: { email: 'next@example.test', password: true },
                    secretHash: 'hash-op'
                }
            }
            await store.replace(token)
            await expect(consume(token.id)).resolves.toMatchObject(token)
        })
    }
)
