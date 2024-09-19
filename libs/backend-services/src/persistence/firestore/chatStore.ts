import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp
} from '@google-cloud/firestore'

import { AlreadyExistsError, InvalidIdError, UnknownStorageError } from '../stores/errors.js'
import { BaseError, Chat, ChatMessage } from '@tabletop/common'
import { isFirestoreError } from './errors.js'
import { ChatStore } from '../stores/chatStore.js'

export class FirestoreChatStore implements ChatStore {
    constructor(private readonly firestore: Firestore) {}

    async findGameChat(gameId: string): Promise<Chat | undefined> {
        const collection = this.getGameChatCollection(gameId)
        const doc = collection.doc(gameId)
        try {
            return (await doc.get()).data() as Chat
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async addMessage(message: ChatMessage, chat: Chat): Promise<Chat> {
        return chat
    }

    private getGameChatCollection(gameId: string): CollectionReference {
        return this.firestore.collection('games').doc(gameId).collection('chats')
        // .withConverter(chatConverter)
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
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

// const tokenConverter = {
//     toFirestore(dataToken: DataToken): PartialWithFieldValue<DataToken> {
//         dataToken.data = JSON.stringify(dataToken.data)
//         return dataToken
//     },
//     fromFirestore(snapshot: QueryDocumentSnapshot): DataToken {
//         const data = snapshot.data() as StoredDataToken
//         data.data = JSON.parse(data.data)

//         // Convert back to dates
//         data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
//         data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
//         data.expiration = (data.expiration as Timestamp).toDate()
//         return data
//     }
// }
