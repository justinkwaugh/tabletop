import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp,
    Transaction
} from '@google-cloud/firestore'
import { Value } from 'typebox/value'
import { BaseError } from '@tabletop/common'
import { AuthenticationChallengeRecord } from '../../challenges/authenticationChallenge.js'
import type { AuthenticationChallengeStore } from '../stores/authenticationChallengeStore.js'
import { InvalidIdError, UnknownStorageError } from '../stores/errors.js'

export class FirestoreAuthenticationChallengeStore implements AuthenticationChallengeStore {
    readonly challenges: CollectionReference<AuthenticationChallengeRecord>

    constructor(firestore: Firestore) {
        this.challenges = firestore
            .collection('authenticationChallenges')
            .withConverter(challengeConverter)
    }

    async replace(key: string, record: AuthenticationChallengeRecord): Promise<void> {
        if (!this.isValidId(key)) {
            throw new InvalidIdError({ type: 'AuthenticationChallengeRecord', id: key })
        }
        try {
            await this.challenges.doc(key).set(record)
        } catch (error) {
            this.handleError(error, key)
        }
    }

    async find(
        transaction: Transaction,
        key: string
    ): Promise<AuthenticationChallengeRecord | undefined> {
        if (!this.isValidId(key)) {
            return undefined
        }
        try {
            return (await transaction.get(this.challenges.doc(key))).data()
        } catch (error) {
            this.handleError(error, key)
        }
    }

    delete(transaction: Transaction, key: string): void {
        transaction.delete(this.challenges.doc(key))
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
    }

    private handleError(error: unknown, id: string): never {
        if (error instanceof BaseError) {
            throw error
        }
        throw new UnknownStorageError({
            type: 'AuthenticationChallengeRecord',
            id,
            cause: error instanceof Error ? error : undefined
        })
    }
}

const challengeConverter = {
    toFirestore(
        record: AuthenticationChallengeRecord
    ): PartialWithFieldValue<AuthenticationChallengeRecord> {
        return record
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): AuthenticationChallengeRecord {
        const data = snapshot.data()
        const record = Value.Convert(AuthenticationChallengeRecord, {
            ...data,
            expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : undefined
        })
        if (!Value.Check(AuthenticationChallengeRecord, record)) {
            throw new Error(`Stored authentication challenge ${snapshot.id} is malformed`)
        }
        return record
    }
}
