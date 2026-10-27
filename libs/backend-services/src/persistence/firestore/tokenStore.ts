import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp
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

    async find(id: string): Promise<DataToken | undefined> {
        const doc = this.tokens.doc(id)
        try {
            const dataToken = (await doc.withConverter(tokenConverter).get()).data()
            return dataToken
        } catch (error) {
            this.handleError(error, id)
        }
    }

    async create(token: DataToken): Promise<DataToken> {
        const newToken = structuredClone(token) as DataToken

        // Set dates
        newToken.createdAt = new Date()
        newToken.updatedAt = new Date()

        // Ensure fields can be used as id
        if (!this.isValidId(newToken.id)) {
            throw new InvalidIdError({ type: 'DataToken', id: secretReference(newToken.id) })
        }

        try {
            await this.tokens.doc(newToken.id).withConverter(tokenConverter).create(newToken)
        } catch (error) {
            this.handleError(error, newToken.id)
        }
        return newToken
    }

    async delete(id: string): Promise<void> {
        try {
            await this.tokens.doc(id).delete()
        } catch (error) {
            this.handleError(error, id)
        }
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
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
