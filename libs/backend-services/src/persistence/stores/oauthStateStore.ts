import type { OAuthStateRecord } from '../../oauth/oauthState.js'

export interface OAuthStateStore {
    create(record: OAuthStateRecord): Promise<void>
    consume(state: string): Promise<OAuthStateRecord | undefined>
}
