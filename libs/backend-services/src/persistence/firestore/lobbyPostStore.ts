import { CollectionReference, Firestore } from '@google-cloud/firestore'
import { BaseError } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { LobbyPostStore } from '../stores/lobbyPostStore.js'
import {
    SingleChannelLobbyPost,
    StoredLobbyPost,
    type LobbyMessage
} from '../model/storedLobbyPost.js'
import { UnknownStorageError } from '../stores/errors.js'

export class FirestoreLobbyPostStore implements LobbyPostStore {
    private readonly posts: CollectionReference

    constructor(private readonly firestore: Firestore) {
        this.posts = firestore.collection('discordLobbyPosts')
    }

    async findPost(gameId: string): Promise<StoredLobbyPost | undefined> {
        try {
            return this.stored((await this.posts.doc(gameId).get()).data())
        } catch (error) {
            this.handleError(error, gameId)
        }
    }

    async claimMessage(gameId: string, message: LobbyMessage): Promise<LobbyMessage> {
        try {
            return await this.firestore.runTransaction(async (transaction) => {
                const reference = this.posts.doc(gameId)
                const channels = this.stored((await transaction.get(reference)).data())?.channels
                const { channelId, messageId } = message
                const posted = channels?.[channelId]
                if (posted?.messageId) return { channelId, messageId: posted.messageId }
                const post: StoredLobbyPost = {
                    gameId,
                    channels: {
                        ...channels,
                        [channelId]: { posts: (posted?.posts ?? 0) + 1, messageId }
                    }
                }
                transaction.set(reference, post)
                return message
            })
        } catch (error) {
            this.handleError(error, gameId)
        }
    }

    async clearMessage(gameId: string, message: LobbyMessage): Promise<void> {
        try {
            await this.firestore.runTransaction(async (transaction) => {
                const reference = this.posts.doc(gameId)
                const channels = this.stored((await transaction.get(reference)).data())?.channels
                const posted = channels?.[message.channelId]
                if (!posted || posted.messageId !== message.messageId) return
                const post: StoredLobbyPost = {
                    gameId,
                    channels: { ...channels, [message.channelId]: { posts: posted.posts } }
                }
                transaction.set(reference, post)
            })
        } catch (error) {
            this.handleError(error, gameId)
        }
    }

    // Writes always store the per-channel shape, so a single-channel record is rewritten on its
    // next change.
    private stored(data: unknown): StoredLobbyPost | undefined {
        if (data === undefined) return undefined
        if (Value.Check(StoredLobbyPost, data)) return data
        Value.Assert(SingleChannelLobbyPost, data)
        const { gameId, posts, message } = data
        // A count without a message cannot say which channel it was for, so it is dropped.
        if (!message) return { gameId, channels: {} }
        return {
            gameId,
            channels: { [message.channelId]: { posts, messageId: message.messageId } }
        }
    }

    private handleError(error: unknown, gameId: string): never {
        console.error(error)
        if (error instanceof BaseError) throw error
        throw new UnknownStorageError({
            type: 'LobbyPost',
            id: gameId,
            cause: error instanceof Error ? error : undefined
        })
    }
}
