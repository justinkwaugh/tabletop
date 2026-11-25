import { CollectionReference, FieldValue, Firestore } from '@google-cloud/firestore'
import { BaseError } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { LobbyPostStore } from '../stores/lobbyPostStore.js'
import { StoredLobbyPost, type LobbyMessage } from '../model/storedLobbyPost.js'
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
                const stored = this.stored((await transaction.get(reference)).data())
                if (stored?.message) return stored.message
                transaction.set(reference, { gameId, posts: (stored?.posts ?? 0) + 1, message })
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
                const stored = this.stored((await transaction.get(reference)).data())
                if (stored?.message?.messageId !== message.messageId) return
                transaction.update(reference, { message: FieldValue.delete() })
            })
        } catch (error) {
            this.handleError(error, gameId)
        }
    }

    private stored(data: unknown): StoredLobbyPost | undefined {
        if (data === undefined) return undefined
        Value.Assert(StoredLobbyPost, data)
        return data
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
