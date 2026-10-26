import { Type } from 'typebox'
import * as Value from 'typebox/value'

const API_ENDPOINT = 'https://v5api.tiltify.com'
const TOKEN_REFRESH_MARGIN_MS = 60_000

const TiltifyMoney = Type.Object({ value: Type.String(), currency: Type.String() })

const TokenResponse = Type.Object({
    access_token: Type.String(),
    expires_in: Type.Number()
})

const CampaignResponse = Type.Object({
    data: Type.Object({
        total_amount_raised: TiltifyMoney,
        retired_at: Type.Union([Type.String(), Type.Null()])
    })
})

export type TiltifyCampaignTotal = {
    amount: number
    currency: string
    retired: boolean
}

type AccessToken = { value: string; expiresAt: number }

export class TiltifyApi {
    private token?: AccessToken

    constructor(
        private readonly clientId: string,
        private readonly clientSecret: string,
        private readonly now: () => number = Date.now
    ) {}

    async getCampaignTotal(campaignId: string): Promise<TiltifyCampaignTotal> {
        const response = await this.get(`/api/public/campaigns/${encodeURIComponent(campaignId)}`)
        Value.Assert(CampaignResponse, response)
        const { total_amount_raised: raised, retired_at: retiredAt } = response.data
        return {
            amount: Number(raised.value),
            currency: raised.currency,
            retired: retiredAt !== null
        }
    }

    private async get(path: string): Promise<unknown> {
        const response = await fetch(`${API_ENDPOINT}${path}`, {
            headers: {
                Authorization: `Bearer ${await this.accessToken()}`,
                Accept: 'application/json'
            }
        })
        if (!response.ok) {
            throw new Error(`Tiltify GET ${path} failed with ${response.status}`)
        }
        return await response.json()
    }

    private async accessToken(): Promise<string> {
        if (this.token && this.token.expiresAt - TOKEN_REFRESH_MARGIN_MS > this.now()) {
            return this.token.value
        }
        const response = await fetch(`${API_ENDPOINT}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'public'
            })
        })
        if (!response.ok) {
            throw new Error(`Tiltify token request failed with ${response.status}`)
        }
        const token: unknown = await response.json()
        Value.Assert(TokenResponse, token)
        this.token = {
            value: token.access_token,
            expiresAt: this.now() + token.expires_in * 1000
        }
        return this.token.value
    }
}
