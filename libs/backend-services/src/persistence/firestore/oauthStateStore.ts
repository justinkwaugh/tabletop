import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp
} from '@google-cloud/firestore'
import { Value } from 'typebox/value'
import { BaseError } from '@tabletop/common'
import { OAuthStateRecord } from '../../oauth/oauthState.js'
import type { OAuthStateStore } from '../stores/oauthStateStore.js'
import { AlreadyExistsError, InvalidIdError, UnknownStorageError } from '../stores/errors.js'
import { isFirestoreError } from './errors.js'

export class FirestoreOAuthStateStore implements OAuthStateStore {
    readonly states: CollectionReference<OAuthStateRecord>

    constructor(firestore: Firestore) {
        this.states = firestore.collection('oauthStates').withConverter(stateConverter)
    }

    async create(record: OAuthStateRecord): Promise<void> {
        if (!this.isValidId(record.state)) {
            throw new InvalidIdError({ type: 'OAuthStateRecord', id: record.state })
        }
        try {
            await this.states.doc(record.state).create(record)
        } catch (error) {
            this.handleError(error, record.state)
        }
    }

    async consume(state: string): Promise<OAuthStateRecord | undefined> {
        if (!this.isValidId(state)) {
            return undefined
        }
        try {
            return await this.states.firestore.runTransaction(async (transaction) => {
                const reference = this.states.doc(state)
                const record = (await transaction.get(reference)).data()
                if (record) {
                    transaction.delete(reference)
                }
                return record
            })
        } catch (error) {
            this.handleError(error, state)
        }
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
    }

    private handleError(error: unknown, id: string): never {
        if (error instanceof BaseError) {
            throw error
        }
        if (isFirestoreError(error) && error.code === 6) {
            throw new AlreadyExistsError({
                type: 'OAuthStateRecord',
                id,
                field: 'state',
                cause: error instanceof Error ? error : undefined
            })
        }
        throw new UnknownStorageError({
            type: 'OAuthStateRecord',
            id,
            cause: error instanceof Error ? error : undefined
        })
    }
}

const stateConverter = {
    toFirestore(record: OAuthStateRecord): PartialWithFieldValue<OAuthStateRecord> {
        return record
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): OAuthStateRecord {
        const data = snapshot.data()
        const record = Value.Convert(OAuthStateRecord, {
            ...data,
            expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : undefined
        })
        if (!Value.Check(OAuthStateRecord, record)) {
            throw new Error(`Stored OAuth state ${snapshot.id} is malformed`)
        }
        return record
    }
}
