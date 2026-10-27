import { createHash, timingSafeEqual } from 'node:crypto'
import { customAlphabet } from 'nanoid'
import { Value } from 'typebox/value'
import { AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS } from '@tabletop/common'
import type { AuthenticationChallengeStore } from '../persistence/stores/authenticationChallengeStore.js'
import type { TransactionParticipant } from '../persistence/stores/transaction.js'
import {
    type AuthenticationChallengeClaim,
    type AuthenticationChallengeRecord,
    authenticationChallengeKey,
    CHALLENGE_SECRET_LENGTH,
    InvalidChallengeError,
    type IssuedChallenge
} from './authenticationChallenge.js'

// No 0, O, 1, I or l: a code is read from an email and typed by hand
const SECRET_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export class AuthenticationChallengeService {
    constructor(
        private readonly store: AuthenticationChallengeStore,
        private readonly options: { lifetimeSeconds?: number; now?: () => Date } = {}
    ) {}

    async issue(claim: AuthenticationChallengeClaim): Promise<IssuedChallenge> {
        const secret = customAlphabet(SECRET_ALPHABET, CHALLENGE_SECRET_LENGTH[claim.purpose])()
        const expiresAt = this.expiry(this.now())
        const record: AuthenticationChallengeRecord = {
            ...claim,
            secretHash: this.hash(secret),
            expiresAt
        }
        await this.store.replace(authenticationChallengeKey(claim), record)
        return { secret, expiresAt }
    }

    expiry(from: Date): Date {
        return new Date(from.getTime() + this.lifetimeSeconds() * 1000)
    }

    consumption(secret: string, expected: AuthenticationChallengeClaim): TransactionParticipant {
        return async (transaction) => {
            const key = authenticationChallengeKey(expected)
            const record = await this.store.find(transaction, key)
            if (!record) {
                throw new InvalidChallengeError('unknown')
            }
            if (record.expiresAt <= this.now()) {
                throw new InvalidChallengeError('expired')
            }
            if (!this.matches(secret, record.secretHash)) {
                throw new InvalidChallengeError('secret')
            }
            const { secretHash: _secretHash, expiresAt: _expiresAt, ...claim } = record
            if (!Value.Equal(claim, expected)) {
                throw new InvalidChallengeError('binding')
            }
            this.store.delete(transaction, key)
        }
    }

    private hash(secret: string): string {
        return createHash('sha256').update(secret).digest('base64url')
    }

    private matches(secret: string, secretHash: string): boolean {
        const presented = Buffer.from(this.hash(secret))
        const stored = Buffer.from(secretHash)
        return presented.length === stored.length && timingSafeEqual(presented, stored)
    }

    private now(): Date {
        return this.options.now?.() ?? new Date()
    }

    private lifetimeSeconds(): number {
        return this.options.lifetimeSeconds ?? AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS
    }
}
