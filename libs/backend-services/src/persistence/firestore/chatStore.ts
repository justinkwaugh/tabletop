import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp,
    Transaction
} from '@google-cloud/firestore'

import { AlreadyExistsError, UnknownStorageError } from '../stores/errors.js'
import { addToChecksum, BaseError, GameChat, GameChatMessage } from '@tabletop/common'
import { isFirestoreError } from './errors.js'
import { ChatStore } from '../stores/chatStore.js'
import { RedisCacheService } from '../../cache/cacheService.js'
import { StoredGameChat } from '../model/storedGameChat.js'
import { nanoid } from 'nanoid'

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

        return await this.cacheService.getThenCacheIfMissing(cacheKey, generateEtag)
    }

    private getGameChatCollection(gameId: string): CollectionReference {
        return this.firestore
            .collection('games')
            .doc(gameId)
            .collection('chats')
            .withConverter(gameChatConverter)
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
