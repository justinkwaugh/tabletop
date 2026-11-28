import { CollectionReference, Firestore, Timestamp } from '@google-cloud/firestore'
import { BaseError } from '@tabletop/common'
import type { NoticeStore } from '../stores/noticeStore.js'
import { UnknownStorageError } from '../stores/errors.js'

export class FirestoreNoticeStore implements NoticeStore {
    private readonly notices: CollectionReference

    constructor(firestore: Firestore) {
        this.notices = firestore.collection('notices')
    }

    async findQueuedAt(noticeId: string): Promise<Date | undefined> {
        try {
            const queuedAt = (await this.notices.doc(noticeId).get()).get('queuedAt')
            return queuedAt instanceof Timestamp ? queuedAt.toDate() : undefined
        } catch (error) {
            this.handleError(error, noticeId)
        }
    }

    async recordQueued(noticeId: string, queuedAt: Date, queued: number): Promise<void> {
        try {
            await this.notices.doc(noticeId).set({ queuedAt, queued })
        } catch (error) {
            this.handleError(error, noticeId)
        }
    }

    private handleError(error: unknown, noticeId: string): never {
        console.error(error)
        if (error instanceof BaseError) throw error
        throw new UnknownStorageError({
            type: 'Notice',
            id: noticeId,
            cause: error instanceof Error ? error : undefined
        })
    }
}
