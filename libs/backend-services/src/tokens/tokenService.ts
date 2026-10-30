import { createHash, timingSafeEqual } from 'node:crypto'
import { customAlphabet } from 'nanoid'
import { Retryable } from 'typescript-retry-decorator'
import { Type } from 'typebox'
import { Value } from 'typebox/value'
import { AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS } from '@tabletop/common'
import { TokenStore } from '../persistence/stores/tokenStore.js'
import { DataToken, TokenType } from './dataToken.js'
import { AlreadyExistsError } from '../persistence/stores/errors.js'
import type { TransactionParticipant } from '../persistence/stores/transaction.js'
import {
    type AuthenticationChallengeClaim,
    type IssuedChallenge,
    InvalidChallengeError
} from './authenticationChallenge.js'

export { TokenType } from './dataToken.js'

const DEFAULT_LENGTH = 16
const DEFAULT_EXPIRATION = 60 * 60 // one hour

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export interface CreateTokenOptions<T> {
    type: Exclude<TokenType, AuthenticationChallengeClaim['type']>
    data: T
    length?: number
    expiresInSeconds?: number
}

export class TokenService {
    constructor(
        private readonly tokenStore: TokenStore,
        private readonly options: { now?: () => Date } = {}
    ) {}

    @Retryable({
        maxAttempts: 3,
        value: [AlreadyExistsError]
    })
    async createToken<T>({
        type,
        data,
        length = DEFAULT_LENGTH,
        expiresInSeconds = DEFAULT_EXPIRATION
    }: CreateTokenOptions<T>): Promise<string> {
        const tokenValue = customAlphabet(alphabet, length)()
        const dataToken: DataToken = {
            id: tokenValue,
            type,
            expiration: new Date(this.now().getTime() + expiresInSeconds * 1000),
            data
        }
        await this.tokenStore.create(dataToken)
        return tokenValue
    }

    async invalidateToken(token: string): Promise<void> {
        await this.tokenStore.delete(token)
    }

    async getData<T>({
        token,
        expectedType
    }: {
        token: string
        expectedType: CreateTokenOptions<T>['type']
    }): Promise<T | undefined> {
        const dataToken = await this.tokenStore.find(token)
        if (!dataToken || dataToken.expiration < this.now() || dataToken.type !== expectedType) {
            return undefined
        }
        return dataToken.data as T
    }

    async issueChallenge(claim: AuthenticationChallengeClaim): Promise<IssuedChallenge> {
        const secret = customAlphabet(alphabet, claim.type === TokenType.PasswordReset ? 32 : 6)()
        const expiresAt = new Date(
            this.now().getTime() + AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS * 1000
        )
        const { type, ...data } = claim
        await this.tokenStore.replace({
            id: this.challengeKey(claim),
            type,
            expiration: expiresAt,
            data: { ...data, secretHash: this.hash(secret) }
        })
        return { secret, expiresAt }
    }

    consumeChallenge(
        secret: string,
        expected: AuthenticationChallengeClaim
    ): TransactionParticipant {
        return async (transaction) => {
            const key = this.challengeKey(expected)
            const token = await this.tokenStore.find(key, transaction)
            if (!token) {
                throw new InvalidChallengeError('unknown')
            }
            if (token.expiration <= this.now()) {
                throw new InvalidChallengeError('expired')
            }
            const data: unknown = token.data
            if (!Value.Check(Type.Object({ secretHash: Type.String() }), data)) {
                throw new InvalidChallengeError('binding')
            }
            if (!this.matches(secret, data.secretHash)) {
                throw new InvalidChallengeError('secret')
            }
            const { type, ...expectedData } = expected
            if (
                token.type !== type ||
                !Value.Equal(data, { ...expectedData, secretHash: data.secretHash })
            ) {
                throw new InvalidChallengeError('binding')
            }
            await this.tokenStore.delete(key, transaction)
        }
    }

    private challengeKey(claim: AuthenticationChallengeClaim): string {
        return `${claim.type}:${claim.userId}`
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
}
