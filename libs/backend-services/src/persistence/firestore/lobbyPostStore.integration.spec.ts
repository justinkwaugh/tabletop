import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Firestore } from '@google-cloud/firestore'
import { FirestoreLobbyPostStore } from './lobbyPostStore.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'

const message = { channelId: 'lobby-1', messageId: 'msg-1' }
const posted = (posts: number, messageId?: string) => ({
    gameId: 'game-1',
    channels: { 'lobby-1': { posts, messageId } }
})

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Lobby posts in Firestore', () => {
    let db: Firestore
    let store: FirestoreLobbyPostStore

    beforeEach(() => {
        db = isolatedFirestore()
        store = new FirestoreLobbyPostStore(db)
    })

    afterEach(async () => {
        await db.terminate()
    })

    it('records the first message of a game and counts it', async () => {
        expect(await store.findPost('game-1')).toBeUndefined()
        expect(await store.claimMessage('game-1', message)).toEqual(message)
        expect(await store.findPost('game-1')).toEqual(posted(1, 'msg-1'))
    })

    it('keeps the message already recorded', async () => {
        const claims = await Promise.all([
            store.claimMessage('game-1', message),
            store.claimMessage('game-1', { ...message, messageId: 'msg-2' })
        ])

        expect(claims[0]).toEqual(claims[1])
        expect((await store.findPost('game-1'))?.channels['lobby-1']?.posts).toBe(1)
    })

    it('clears only the message it is told, keeping the count', async () => {
        await store.claimMessage('game-1', message)
        await store.clearMessage('game-1', { ...message, messageId: 'other' })
        expect(await store.findPost('game-1')).toEqual(posted(1, 'msg-1'))

        await store.clearMessage('game-1', message)
        expect(await store.findPost('game-1')).toEqual(posted(1))

        await store.claimMessage('game-1', { ...message, messageId: 'msg-2' })
        expect((await store.findPost('game-1'))?.channels['lobby-1']?.posts).toBe(2)
    })

    it('keeps a message and count in each channel', async () => {
        await store.claimMessage('game-1', message)
        await store.claimMessage('game-1', { channelId: 'live', messageId: 'msg-2' })
        await store.clearMessage('game-1', message)

        expect(await store.findPost('game-1')).toEqual({
            gameId: 'game-1',
            channels: { 'lobby-1': { posts: 1 }, live: { posts: 1, messageId: 'msg-2' } }
        })
    })

    it('reads a single-channel record as its channel’s post and keeps it on the next claim', async () => {
        await db
            .collection('discordLobbyPosts')
            .doc('game-1')
            .set({ gameId: 'game-1', posts: 2, message })

        expect(await store.findPost('game-1')).toEqual(posted(2, 'msg-1'))
        expect(await store.claimMessage('game-1', { ...message, messageId: 'other' })).toEqual(
            message
        )
        await store.claimMessage('game-1', { channelId: 'live', messageId: 'msg-2' })

        expect(await store.findPost('game-1')).toEqual({
            gameId: 'game-1',
            channels: {
                'lobby-1': { posts: 2, messageId: 'msg-1' },
                live: { posts: 1, messageId: 'msg-2' }
            }
        })
    })

    it('clears nothing for a game never posted', async () => {
        await store.clearMessage('game-1', message)
        expect(await store.findPost('game-1')).toBeUndefined()
    })
})
