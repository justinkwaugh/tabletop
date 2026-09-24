import { PreferenceRecord } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import type { Firestore, DocumentSnapshot } from '@google-cloud/firestore'
import type { PreferenceStore } from './preferenceStore.js'
import { measure } from '../diagnostics/requestTimings.js'

const validator = Compile(PreferenceRecord)

export class FirestorePreferenceStore implements PreferenceStore {
    constructor(private readonly firestore: Firestore) {}

    private refs(userId: string, scopes: readonly string[]) {
        return scopes.map((scope) =>
            this.firestore
                .collection('users')
                .doc(userId)
                .collection('preferences')
                .doc(encodeURIComponent(scope))
        )
    }
    private record(snapshot: DocumentSnapshot): PreferenceRecord | undefined {
        if (!snapshot.exists) return undefined
        const stored = snapshot.data()
        const data: unknown = stored && typeof stored.values === 'string'
            ? { ...stored, values: JSON.parse(stored.values) }
            : stored
        if (!validator.Check(data)) throw new Error('Invalid stored preferences')
        return data
    }
    async read(userId: string, scopes: readonly string[]) {
        return measure('store.preferences.read', () =>
            this.firestore.runTransaction(
                async (transaction) => {
                    const snapshots = await transaction.getAll(...this.refs(userId, scopes))
                    return snapshots.map((snapshot) => this.record(snapshot))
                },
                { readOnly: true }
            )
        )
    }
    async update(
        userId: string,
        scopes: readonly string[],
        change: Parameters<PreferenceStore['update']>[2]
    ) {
        return measure('store.preferences.update', () =>
            this.firestore.runTransaction(async (transaction) => {
                const refs = this.refs(userId, scopes)
                const snapshots = await transaction.getAll(...refs)
                const result = change(snapshots.map((snapshot) => this.record(snapshot)))
                const record = result.records[result.changedIndex]
                transaction.set(refs[result.changedIndex], { ...record, values: JSON.stringify(record.values) })
                return result.records
            })
        )
    }
}
