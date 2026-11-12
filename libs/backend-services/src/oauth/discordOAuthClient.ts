import { type Static, Type } from 'typebox'
import { Value } from 'typebox/value'

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize'
const API_ENDPOINT = 'https://discord.com/api'
const SCOPES = ['identify', 'email']

export type DiscordIdentity = {
    externalId: string
    email?: string
    emailVerified?: boolean
}

export interface DiscordOAuth {
    authorizationUrl(request: { redirectUri: string; state: string }): string
    exchangeCode(request: {
        code: string
        redirectUri: string
    }): Promise<DiscordIdentity | undefined>
}

type TokenResponse = Static<typeof TokenResponse>
const TokenResponse = Type.Object({ access_token: Type.String() })

type CurrentAuthorization = Static<typeof CurrentAuthorization>
const CurrentAuthorization = Type.Object({
    user: Type.Optional(
        Type.Object({
            id: Type.String(),
            email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            verified: Type.Optional(Type.Boolean())
        })
    )
})

export class DiscordOAuthClient implements DiscordOAuth {
    constructor(
        private readonly options: {
            clientId: string
            clientSecret: () => Promise<string>
            fetch?: typeof fetch
        }
    ) {}

    authorizationUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
        const url = new URL(AUTHORIZE_URL)
        url.search = new URLSearchParams({
            client_id: this.options.clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: SCOPES.join(' '),
            state
        }).toString()
        return url.toString()
    }

    async exchangeCode({
        code,
        redirectUri
    }: {
        code: string
        redirectUri: string
    }): Promise<DiscordIdentity | undefined> {
        const token = await this.readJson(TokenResponse, `${API_ENDPOINT}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.options.clientId,
                client_secret: await this.options.clientSecret(),
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri
            })
        })
        if (!token) {
            return undefined
        }
        const authorization = await this.readJson(
            CurrentAuthorization,
            `${API_ENDPOINT}/oauth2/@me`,
            { method: 'GET', headers: { Authorization: `Bearer ${token.access_token}` } }
        )
        if (!authorization?.user) {
            return undefined
        }
        const { id, email, verified } = authorization.user
        return { externalId: id, email: email ?? undefined, emailVerified: verified }
    }

    private async readJson<T extends typeof TokenResponse | typeof CurrentAuthorization>(
        schema: T,
        url: string,
        init: RequestInit
    ): Promise<Static<T> | undefined> {
        const response = await (this.options.fetch ?? fetch)(url, init)
        if (!response.ok) {
            return undefined
        }
        const body: unknown = await response.json()
        return Value.Check(schema, body) ? body : undefined
    }
}
