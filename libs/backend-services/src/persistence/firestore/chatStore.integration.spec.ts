import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addToChecksum, REDACTED_CHAT_MESSAGE_TEXT, redactionChecksumValue } from '@tabletop/common'
import { cacheFixture, cacheTestClient } from '../../cache/tests/cacheFixture.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreChatStore } from './chatStore.js'
import { NotFoundError } from '../stores/errors.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Removing a chat message in the Firestore chat store',
    { timeout: 15_000 },
    () => {
        const firestore = isolatedFirestore()
        const client = cacheTestClient()
        const { cache } = cacheFixture(client)
        const store = new FirestoreChatStore(cache, firestore)
        const gameId = `chat-${Date.now()}`
        const message = (id: string, text: string) => ({
            id,
            userId: 'bob',
            playerId: 'seat-bob',
            timestamp: new Date('2026-11-12T12:00:00Z'),
            text
        })

        beforeAll(async () => {
            await client.connect()
            await firestore.collection('games').doc(gameId).set({ id: gameId })
            await store.addGameChatMessage(message('m1', 'rude'), gameId)
            await store.addGameChatMessage(message('m2', 'rematch?'), gameId)
        })
        afterAll(async () => {
            cache.destroy()
            client.destroy()
            await firestore.terminate()
        })

        it('replaces the text, keeps the id, and changes the checksum and chat revision', async () => {
            const before = await store.findGameChat(gameId)
            const etag = await store.getGameChatEtag(gameId)

            const result = await store.redactGameChatMessage(gameId, 'm1')

            expect(result).toMatchObject({
                originalText: 'rude',
                alreadyRedacted: false,
                message: { id: 'm1', text: REDACTED_CHAT_MESSAGE_TEXT, redacted: true }
            })
            const after = await store.findGameChat(gameId)
            expect(after?.checksum).toBe(
                addToChecksum(before?.checksum ?? 0, [redactionChecksumValue('m1')])
            )
            expect(after?.messages.map((m) => m.text)).toEqual([
                REDACTED_CHAT_MESSAGE_TEXT,
                'rematch?'
            ])
            expect(await store.getGameChatEtag(gameId)).not.toBe(etag)
        })

        it('reports a second removal without writing', async () => {
            await expect(store.redactGameChatMessage(gameId, 'm1')).resolves.toMatchObject({
                alreadyRedacted: true,
                originalText: ''
            })
        })

        it('refuses a message that is not in the chat', async () => {
            await expect(store.redactGameChatMessage(gameId, 'missing')).rejects.toBeInstanceOf(
                NotFoundError
            )
        })
    }
)
