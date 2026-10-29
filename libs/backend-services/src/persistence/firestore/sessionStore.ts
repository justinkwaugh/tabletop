import { measure } from '../../diagnostics/requestTimings.js'
import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp
} from '@google-cloud/firestore'
import { Value } from 'typebox/value'
import { BaseError } from '@tabletop/common'
import { AuthenticatedSession } from '../../sessions/authenticatedSession.js'
import { RedisCacheService } from '../../cache/cacheService.js'
import type { SessionStore } from '../stores/sessionStore.js'
import { AlreadyExistsError, InvalidIdError, UnknownStorageError } from '../stores/errors.js'
import { isFirestoreError } from './errors.js'

const CACHE_SECONDS = 60 * 60

export class FirestoreSessionStore implements SessionStore {
    readonly sessions: CollectionReference<AuthenticatedSession>

    constructor(
        private readonly cacheService: RedisCacheService,
        firestore: Firestore
    ) {
        this.sessions = firestore.collection('sessions').withConverter(sessionConverter)
    }

    async create(session: AuthenticatedSession): Promise<void> {
        if (!this.isValidId(session.id)) {
            throw new InvalidIdError({ type: 'AuthenticatedSession', id: session.id })
        }
        try {
            await this.cacheService.lockWhileWriting([this.cacheKey(session.id)], () =>
                this.sessions.doc(session.id).create(session)
            )
        } catch (error) {
            this.handleError(error, session.id)
        }
    }

    async find(id: string): Promise<AuthenticatedSession | undefined> {
        const cached = await this.cacheService.cachingGet(
            this.cacheKey(id),
            () => this.read(id),
            CACHE_SECONDS
        )
        if (cached === undefined) {
            return undefined
        }
        const session = Value.Convert(AuthenticatedSession, cached)
        return Value.Check(AuthenticatedSession, session) ? session : undefined
    }

    async delete(id: string): Promise<void> {
        try {
            await this.cacheService.lockWhileWriting([this.cacheKey(id)], () =>
                this.sessions.doc(id).delete()
            )
        } catch (error) {
            this.handleError(error, id)
        }
    }

    async deleteForUser(userId: string, { except }: { except?: string } = {}): Promise<void> {
        try {
            await this.cacheService.lockWhileWriting([], (locks) =>
                this.sessions.firestore.runTransaction(async (transaction) => {
                    const snapshot = await transaction.get(
                        this.sessions.where('userId', '==', userId)
                    )
                    this.recordRead(snapshot.size)
                    const ids = snapshot.docs.map((doc) => doc.id).filter((id) => id !== except)
                    await locks.addKeys(ids.map((id) => this.cacheKey(id)))
                    for (const id of ids) {
                        transaction.delete(this.sessions.doc(id))
                    }
                })
            )
        } catch (error) {
            this.handleError(error, userId)
        }
    }

    private async read(id: string): Promise<AuthenticatedSession | undefined> {
        if (!this.isValidId(id)) {
            return undefined
        }
        try {
            const snapshot = await measure('firestore.session.get', () =>
                this.sessions.doc(id).get()
            )
            this.recordRead()
            return snapshot.data()
        } catch (error) {
            this.handleError(error, id)
        }
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
    }

    private cacheKey(id: string): string {
        return `session-${id}`
    }

    private recordRead(count?: number) {
        this.cacheService.incrementValue('db-read-session', count).catch((error) => {
            console.error('Failed to increment session reads', error)
        })
    }

    private handleError(error: unknown, id: string): never {
        if (error instanceof BaseError) {
            throw error
        }
        if (isFirestoreError(error) && error.code === 6) {
            throw new AlreadyExistsError({
                type: 'AuthenticatedSession',
                id,
                field: 'id',
                cause: error instanceof Error ? error : undefined
            })
        }
        throw new UnknownStorageError({
            type: 'AuthenticatedSession',
            id,
            cause: error instanceof Error ? error : undefined
        })
    }
}

const sessionConverter = {
    toFirestore(session: AuthenticatedSession): PartialWithFieldValue<AuthenticatedSession> {
        return session
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): AuthenticatedSession {
        const data = snapshot.data()
        const session = Value.Convert(AuthenticatedSession, {
            ...data,
            createdAt: toDate(data.createdAt),
            authenticatedAt: toDate(data.authenticatedAt),
            expiresAt: toDate(data.expiresAt)
        })
        if (!Value.Check(AuthenticatedSession, session)) {
            throw new Error(`Stored session ${snapshot.id} is malformed`)
        }
        return session
    }
}

function toDate(value: unknown): Date | undefined {
    return value instanceof Timestamp ? value.toDate() : undefined
}
