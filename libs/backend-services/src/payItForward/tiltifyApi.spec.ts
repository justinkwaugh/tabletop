import { afterEach, describe, expect, it, vi } from 'vitest'
import { TiltifyApi } from './tiltifyApi.js'

afterEach(() => {
    vi.unstubAllGlobals()
})

const tokenResponse = (expiresIn = 7200) =>
    new Response(JSON.stringify({ access_token: 'token-1', expires_in: expiresIn }))

const campaignResponse = (retiredAt: string | null = null) =>
    new Response(
        JSON.stringify({
            data: {
                id: 'campaign-1',
                amount_raised: { value: '10.00', currency: 'GBP' },
                total_amount_raised: { value: '12.50', currency: 'GBP' },
                retired_at: retiredAt
            }
        })
    )

describe('TiltifyApi', () => {
    it('reads the campaign total with an application token and asks for JSON', async () => {
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockResolvedValueOnce(tokenResponse())
            .mockResolvedValueOnce(campaignResponse())
        vi.stubGlobal('fetch', fetch)

        const total = await new TiltifyApi('id', 'secret').getCampaignTotal('campaign-1')

        expect(total).toEqual({ amount: 12.5, currency: 'GBP', retired: false })
        const [tokenUrl, tokenInit] = fetch.mock.calls[0]
        expect(tokenUrl).toBe('https://v5api.tiltify.com/oauth/token')
        expect(JSON.parse(String(tokenInit?.body))).toEqual({
            grant_type: 'client_credentials',
            client_id: 'id',
            client_secret: 'secret',
            scope: 'public'
        })
        const [campaignUrl, campaignInit] = fetch.mock.calls[1]
        expect(campaignUrl).toBe('https://v5api.tiltify.com/api/public/campaigns/campaign-1')
        const headers = new Headers(campaignInit?.headers)
        expect(headers.get('authorization')).toBe('Bearer token-1')
        expect(headers.get('accept')).toBe('application/json')
    })

    it('reports a retired campaign', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn<typeof globalThis.fetch>()
                .mockResolvedValueOnce(tokenResponse())
                .mockResolvedValueOnce(campaignResponse('2027-05-01T00:00:00Z'))
        )
        const total = await new TiltifyApi('id', 'secret').getCampaignTotal('campaign-1')
        expect(total.retired).toBe(true)
    })

    it('reuses the token until shortly before it expires', async () => {
        let now = 0
        const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
            String(input).endsWith('/oauth/token') ? tokenResponse(120) : campaignResponse()
        )
        vi.stubGlobal('fetch', fetch)
        const api = new TiltifyApi('id', 'secret', () => now)
        const tokenRequests = () =>
            fetch.mock.calls.filter(([input]) => String(input).endsWith('/oauth/token')).length

        await api.getCampaignTotal('campaign-1')
        now = 59_000
        await api.getCampaignTotal('campaign-1')
        expect(tokenRequests()).toBe(1)

        now = 61_000
        await api.getCampaignTotal('campaign-1')
        expect(tokenRequests()).toBe(2)
    })

    it('fails when Tiltify answers with an error', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn<typeof globalThis.fetch>()
                .mockResolvedValueOnce(tokenResponse())
                .mockResolvedValueOnce(new Response('<html></html>', { status: 404 }))
        )
        await expect(new TiltifyApi('id', 'secret').getCampaignTotal('missing')).rejects.toThrow(
            'failed with 404'
        )
    })
})
