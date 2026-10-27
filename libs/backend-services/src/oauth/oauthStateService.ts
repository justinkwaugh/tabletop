import { customAlphabet } from 'nanoid'
import { Value } from 'typebox/value'
import type { OAuthStateStore } from '../persistence/stores/oauthStateStore.js'
import {
    InvalidOAuthStateError,
    isOAuthPurpose,
    OAUTH_STATE_LIFETIME_SECONDS,
    type OAuthPurpose,
    type OAuthStateClaim,
    type OAuthStateRecord
} from './oauthState.js'

const STATE_SEPARATOR = '.'
const NONCE_LENGTH = 32
const nonce = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    NONCE_LENGTH
)

export function oauthStatePurpose(state: string): OAuthPurpose | undefined {
    const separator = state.indexOf(STATE_SEPARATOR)
    if (separator < 0) {
        return undefined
    }
    const purpose = state.slice(0, separator)
    return isOAuthPurpose(purpose) ? purpose : undefined
}

export class OAuthStateService {
    constructor(
        private readonly store: OAuthStateStore,
        private readonly options: { lifetimeSeconds?: number; now?: () => Date } = {}
    ) {}

    async issue(claim: OAuthStateClaim): Promise<OAuthStateRecord> {
        const record: OAuthStateRecord = {
            ...claim,
            state: `${claim.purpose}${STATE_SEPARATOR}${nonce()}`,
            expiresAt: new Date(this.now().getTime() + this.lifetimeSeconds() * 1000)
        }
        await this.store.create(record)
        return record
    }

    async consume(state: string, expected: OAuthStateClaim): Promise<void> {
        if (oauthStatePurpose(state) !== expected.purpose) {
            throw new InvalidOAuthStateError('purpose')
        }
        const record = await this.store.consume(state)
        if (!record) {
            throw new InvalidOAuthStateError('unknown')
        }
        if (record.expiresAt <= this.now()) {
            throw new InvalidOAuthStateError('expired')
        }
        const { state: _state, expiresAt: _expiresAt, ...claim } = record
        if (!Value.Equal(claim, expected)) {
            throw new InvalidOAuthStateError('binding')
        }
    }

    private now(): Date {
        return this.options.now?.() ?? new Date()
    }

    private lifetimeSeconds(): number {
        return this.options.lifetimeSeconds ?? OAUTH_STATE_LIFETIME_SECONDS
    }
}
