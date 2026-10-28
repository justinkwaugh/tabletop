import { DocumentReference, Firestore } from '@google-cloud/firestore'
import { BaseError, type CharityTally } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { CharityTallyStore } from '../stores/charityTallyStore.js'
import { StoredCharityTally } from '../model/storedCharityTally.js'
import { UnknownStorageError } from '../stores/errors.js'

export class FirestoreCharityTallyStore implements CharityTallyStore {
    private readonly latest: DocumentReference

    constructor(firestore: Firestore) {
        this.latest = firestore.collection('payItForward').doc('tally')
    }

    async saveTally(record: StoredCharityTally): Promise<void> {
        try {
            await this.latest.set(record)
        } catch (error) {
            this.handleError(error)
        }
    }

    async findTally(): Promise<CharityTally | undefined> {
        try {
            const stored = (await this.latest.get()).data()
            if (stored === undefined) return undefined
            Value.Assert(StoredCharityTally, stored)
            return stored.tally
        } catch (error) {
            this.handleError(error)
        }
    }

    private handleError(error: unknown): never {
        console.error(error)
        if (error instanceof BaseError) throw error
        throw new UnknownStorageError({
            type: 'CharityTally',
            id: this.latest.path,
            cause: error instanceof Error ? error : undefined
        })
    }
}
