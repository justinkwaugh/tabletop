import { customAlphabet } from 'nanoid'
import { Retryable } from 'typescript-retry-decorator'
import { TokenStore } from '../persistence/stores/tokenStore.js'
import { DataToken } from '../tokens/dataToken.js'
import { AlreadyExistsError } from '../persistence/stores/errors.js'

const DEFAULT_LENGTH = 16
const DEFAULT_EXPIRATION = 60 * 60 // one hour

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export interface CreateTokenOptions<T> {
    type: TokenType
    data: T
    length?: number
    expiresInSeconds?: number
}

export enum TokenType {
    EmailVerification = 'emailVerification',
    Authentication = 'authentication',
    GameInvitation = 'gameInvitation',
    SSEAuthorization = 'sseAuthorization'
}

export class TokenService {
    constructor(private readonly tokenStore: TokenStore) {}

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
        const dataToken = <DataToken>{
            id: tokenValue,
            type,
            expiration: new Date(Date.now() + expiresInSeconds * 1000),
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
        expectedType: TokenType
    }): Promise<T | undefined> {
        const dataToken = await this.tokenStore.find(token)
        if (!dataToken || dataToken.expiration < new Date() || dataToken.type !== expectedType) {
            return undefined
        }
        return dataToken.data as T
    }
}
