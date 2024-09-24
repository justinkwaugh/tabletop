import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp,
    Transaction
} from '@google-cloud/firestore'

import { AlreadyExistsError, UnknownStorageError } from '../stores/errors.js'
import { addToChecksum, BaseError, Bookmark, GameChat, GameChatMessage } from '@tabletop/common'
import { isFirestoreError } from './errors.js'
import { ChatStore } from '../stores/chatStore.js'
import { RedisCacheService } from '../../cache/cacheService.js'
import { StoredGameChat } from '../model/storedGameChat.js'
import { nanoid } from 'nanoid'
import { StoredBookmark } from '../model/storedBookmark.js'
import { Value } from '@sinclair/typebox/value'

const GAME_CHAT_MESSAGE_LIMIT = 2000

export class FirestoreChatStore implements ChatStore {
    constructor(
        private readonly cacheService: RedisCacheService,
        private readonly firestore: Firestore
    ) {}

    async findGameChat(gameId: string): Promise<GameChat | undefined> {
        const collection = this.getGameChatCollection(gameId)
        const doc = collection.doc(gameId)
        try {
            return (await doc.get()).data() as GameChat
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async addGameChatMessage(message: GameChatMessage, gameId: string): Promise<GameChat> {
        const chats = this.getGameChatCollection(gameId)
        const transactionBody = async (
            transaction: Transaction
        ): Promise<{ updatedGameChat: GameChat }> => {
            const existingChat: GameChat | undefined = (
                await transaction.get(chats.doc(gameId))
            ).data() as GameChat | undefined

            const chatToUpdate = existingChat ?? { id: gameId, gameId, messages: [], checksum: 0 }

            if (chatToUpdate.messages.length >= GAME_CHAT_MESSAGE_LIMIT) {
                throw new Error('Chat message limit reached')
            }

            chatToUpdate.messages.push(message)
            chatToUpdate.checksum = addToChecksum(chatToUpdate.checksum, [message.id])

            transaction.set(chats.doc(gameId), chatToUpdate)

            return { updatedGameChat: chatToUpdate }
        }

        const checksumCacheKey = `csum-${gameId}-chat`
        const chatRevisionCacheKey = `etag-${gameId}-chat`

        try {
            const { updatedGameChat } = await this.cacheService.lockWhileWriting(
                [checksumCacheKey, chatRevisionCacheKey],
                async () => chats.firestore.runTransaction(transactionBody)
            )

            return updatedGameChat
        } catch (error) {
            console.log(error)
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async getGameChatEtag(gameId: string): Promise<string | undefined> {
        const cacheKey = `etag-${gameId}-chat`

        const generateEtag = async (): Promise<string> => {
            return nanoid()
        }

        return await this.cacheService.cachingGet(cacheKey, generateEtag)
    }

    async getGameChatBookmark(gameId: string, playerId: string): Promise<Bookmark> {
        const cacheKey = `bookmark-${gameId}-${playerId}`

        const getBookmark = async (): Promise<unknown> => {
            const collection = this.getGameChatBookmarkCollection(gameId)
            const doc = collection.doc(playerId)
            try {
                const bookmark = ((await doc.get()).data() as Bookmark) ?? {
                    id: playerId,
                    lastReadTimestamp: new Date(0)
                }
                return bookmark
            } catch (error) {
                this.handleError(error, gameId)
                throw Error('unreachable')
            }
        }

        const cachedBookmark = await this.cacheService.cachingGet(cacheKey, getBookmark)
        if (!cachedBookmark) {
            throw new Error('Bookmark not found')
        }
        return Value.Convert(Bookmark, cachedBookmark) as Bookmark
    }

    async setGameChatBookmark(gameId: string, bookmark: Bookmark): Promise<void> {
        const bookmarks = this.getGameChatBookmarkCollection(gameId)
        const transactionBody = async (transaction: Transaction): Promise<void> => {
            const bookmarkToSet = structuredClone(bookmark)
            transaction.set(bookmarks.doc(bookmark.id), bookmarkToSet)
        }

        const cacheKey = `bookmark-${gameId}-${bookmark.id}`

        try {
            await this.cacheService.lockWhileWriting([cacheKey], async () =>
                bookmarks.firestore.runTransaction(transactionBody)
            )
        } catch (error) {
            console.log(error)
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    private getGameChatCollection(gameId: string): CollectionReference {
        return this.firestore
            .collection('games')
            .doc(gameId)
            .collection('chats')
            .withConverter(gameChatConverter)
    }

    private getGameChatBookmarkCollection(gameId: string): CollectionReference {
        return this.firestore
            .collection('games')
            .doc(gameId)
            .collection('chats')
            .doc(gameId)
            .collection('bookmarks')
            .withConverter(bookmarkConverter)
    }

    private handleError(error: unknown, id: string) {
        console.log(error)
        if (error instanceof BaseError) {
            throw error
        } else if (isFirestoreError(error) && error.code === 6) {
            // Extract the field from the error message
            const field = 'id'
            throw new AlreadyExistsError({
                type: 'DataToken',
                id,
                field,
                cause: error instanceof Error ? error : undefined
            })
        } else {
            throw new UnknownStorageError({
                type: 'DataToken',
                id,
                cause: error instanceof Error ? error : undefined
            })
        }
    }
}

const gameChatConverter = {
    toFirestore(gameChat: GameChat): PartialWithFieldValue<GameChat> {
        return gameChat
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): GameChat {
        const data = snapshot.data() as StoredGameChat

        for (const message of data.messages) {
            message.timestamp = (message.timestamp as Timestamp).toDate()
        }

        return data
    }
}

const bookmarkConverter = {
    toFirestore(bookmark: Bookmark): PartialWithFieldValue<Bookmark> {
        return bookmark
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): Bookmark {
        const data = snapshot.data() as StoredBookmark
        data.lastReadTimestamp = (data.lastReadTimestamp as Timestamp).toDate()
        return data
    }
}
