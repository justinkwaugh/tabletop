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
import { concealedCause, secretReference } from '../../security/secretReference.js'
import type { SessionStore } from '../stores/sessionStore.js'
import { AlreadyExistsError, InvalidIdError, UnknownStorageError } from '../stores/errors.js'
import { isFirestoreError } from './errors.js'

const CACHE_SECONDS = 60 * 60

// Every serving revision must derive the same key, or a revocation on one revision leaves the
// other's cached session live; the cache service keeps keys out of its diagnostics instead.
export function sessionCacheKey(id: string): string {
    return `session-${id}`
}

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
            throw new InvalidIdError({
                type: 'AuthenticatedSession',
                id: secretReference(session.id)
            })
        }
        try {
            await this.cacheService.lockWhileWriting([sessionCacheKey(session.id)], () =>
                this.sessions.doc(session.id).create(session)
            )
        } catch (error) {
            this.handleError(error, {
                reference: secretReference(session.id),
                secrets: [session.id]
            })
        }
    }

    async find(id: string): Promise<AuthenticatedSession | undefined> {
        const cached = await this.cacheService.cachingGet(
            sessionCacheKey(id),
            () => this.read(id),
            CACHE_SECONDS
        )
        if (cached === undefined) {
            return undefined
        }
        const session = Value.Convert(AuthenticatedSession, cached)
        return Value.Check(AuthenticatedSession, session) ? session : undefined
    }

    async update(
        id: string,
        change: (stored: AuthenticatedSession) => AuthenticatedSession
    ): Promise<AuthenticatedSession | undefined> {
        if (!this.isValidId(id)) {
            return undefined
        }
        try {
            return await this.cacheService.lockWhileWriting([sessionCacheKey(id)], () =>
                this.sessions.firestore.runTransaction(async (transaction) => {
                    const reference = this.sessions.doc(id)
                    const stored = (await transaction.get(reference)).data()
                    this.recordRead()
                    if (!stored) {
                        return undefined
                    }
                    const changed = change(stored)
                    transaction.set(reference, changed)
                    return changed
                })
            )
        } catch (error) {
            this.handleError(error, { reference: secretReference(id), secrets: [id] })
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.cacheService.lockWhileWriting([sessionCacheKey(id)], () =>
                this.sessions.doc(id).delete()
            )
        } catch (error) {
            this.handleError(error, { reference: secretReference(id), secrets: [id] })
        }
    }

    async deleteForUser(userId: string, { except }: { except?: string } = {}): Promise<void> {
        let ids: string[] = []
        try {
            await this.cacheService.lockWhileWriting([], (locks) =>
                this.sessions.firestore.runTransaction(async (transaction) => {
                    const snapshot = await transaction.get(
                        this.sessions.where('userId', '==', userId)
                    )
                    this.recordRead(snapshot.size)
                    ids = snapshot.docs.map((doc) => doc.id).filter((id) => id !== except)
                    await locks.addKeys(ids.map(sessionCacheKey))
                    for (const id of ids) {
                        transaction.delete(this.sessions.doc(id))
                    }
                })
            )
        } catch (error) {
            this.handleError(error, {
                reference: userId,
                secrets: [...ids, ...(except ? [except] : [])]
            })
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
            this.handleError(error, { reference: secretReference(id), secrets: [id] })
        }
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
    }

    private recordRead(count?: number) {
        this.cacheService.incrementValue('db-read-session', count).catch((error) => {
            console.error('Failed to increment session reads', error)
        })
    }

    private handleError(
        error: unknown,
        { reference, secrets }: { reference: string; secrets: string[] }
    ): never {
        if (error instanceof BaseError) {
            throw error
        }
        const cause = concealedCause(error, secrets)
        if (isFirestoreError(error) && error.code === 6) {
            throw new AlreadyExistsError({
                type: 'AuthenticatedSession',
                id: reference,
                field: 'id',
                cause
            })
        }
        throw new UnknownStorageError({ type: 'AuthenticatedSession', id: reference, cause })
    }
}

const sessionConverter = {
    toFirestore(session: AuthenticatedSession): PartialWithFieldValue<AuthenticatedSession> {
        return session
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): AuthenticatedSession {
        const { authenticatedAt, adminModeExpiresAt, providerAuthorization, ...data } =
            snapshot.data()
        const session = Value.Convert(AuthenticatedSession, {
            ...data,
            createdAt: toDate(data.createdAt),
            ...(authenticatedAt === undefined ? {} : { authenticatedAt: toDate(authenticatedAt) }),
            ...(adminModeExpiresAt === undefined
                ? {}
                : { adminModeExpiresAt: toDate(adminModeExpiresAt) }),
            expiresAt: toDate(data.expiresAt),
            ...(providerAuthorization === undefined
                ? {}
                : {
                      providerAuthorization: {
                          ...providerAuthorization,
                          expiresAt: toDate(providerAuthorization.expiresAt)
                      }
                  })
        })
        if (!Value.Check(AuthenticatedSession, session)) {
            throw new Error(`Stored session ${secretReference(snapshot.id)} is malformed`)
        }
        return session
    }
}

function toDate(value: unknown): Date | undefined {
    return value instanceof Timestamp ? value.toDate() : undefined
}
