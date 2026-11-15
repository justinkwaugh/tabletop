import { isValidStorageId } from '../stores/storageId.js'
import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp,
    type Transaction
} from '@google-cloud/firestore'
import { StoredDataToken } from '../model/storedToken.js'
import { DataToken } from '../../tokens/dataToken.js'
import { TokenStore } from '../stores/tokenStore.js'
import { AlreadyExistsError, InvalidIdError, UnknownStorageError } from '../stores/errors.js'
import { BaseError } from '@tabletop/common'
import { concealedCause, secretReference } from '../../security/secretReference.js'
import { isFirestoreError } from './errors.js'

export class FirestoreTokenStore implements TokenStore {
    readonly tokens: CollectionReference

    constructor(private firestore: Firestore) {
        this.tokens = firestore.collection('tokens')
    }

    async find(id: string, transaction?: Transaction): Promise<DataToken | undefined> {
        const doc = this.tokens.doc(id).withConverter(tokenConverter)
        try {
            const snapshot = transaction ? await transaction.get(doc) : await doc.get()
            return snapshot.data()
        } catch (error) {
            this.handleError(error, id)
        }
    }

    async create(token: DataToken): Promise<DataToken> {
        return this.write(token, 'create')
    }

    async replace(token: DataToken): Promise<void> {
        await this.write(token, 'set')
    }

    private async write(token: DataToken, operation: 'create' | 'set'): Promise<DataToken> {
        const newToken = structuredClone(token)

        newToken.createdAt = new Date()
        newToken.updatedAt = new Date()

        if (!isValidStorageId(newToken.id)) {
            throw new InvalidIdError({ type: 'DataToken', id: secretReference(newToken.id) })
        }

        try {
            await this.tokens.doc(newToken.id).withConverter(tokenConverter)[operation](newToken)
        } catch (error) {
            this.handleError(error, newToken.id)
        }
        return newToken
    }

    async delete(id: string, transaction?: Transaction): Promise<void> {
        try {
            const doc = this.tokens.doc(id)
            if (transaction) {
                transaction.delete(doc)
            } else {
                await doc.delete()
            }
        } catch (error) {
            this.handleError(error, id)
        }
    }

    private handleError(error: unknown, token: string): never {
        if (error instanceof BaseError) {
            throw error
        }
        const id = secretReference(token)
        const cause = concealedCause(error, [token])
        if (isFirestoreError(error) && error.code === 6) {
            throw new AlreadyExistsError({ type: 'DataToken', id, field: 'id', cause })
        }
        throw new UnknownStorageError({ type: 'DataToken', id, cause })
    }
}

const tokenConverter = {
    toFirestore(dataToken: DataToken): PartialWithFieldValue<DataToken> {
        dataToken.data = JSON.stringify(dataToken.data)
        return dataToken
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): DataToken {
        const data = snapshot.data() as StoredDataToken
        data.data = JSON.parse(data.data)

        // Convert back to dates
        data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
        data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
        data.expiration = (data.expiration as Timestamp).toDate()
        return data
    }
}
