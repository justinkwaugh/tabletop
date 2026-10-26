import { Type } from 'typebox'
import * as Value from 'typebox/value'

const FRANKFURTER_ENDPOINT = 'https://api.frankfurter.dev/v1/latest'

const LatestRates = Type.Object({ rates: Type.Record(Type.String(), Type.Number()) })

export async function fetchUsdPerUnit(currency: string): Promise<number> {
    if (currency === 'USD') return 1
    const response = await fetch(
        `${FRANKFURTER_ENDPOINT}?base=${encodeURIComponent(currency)}&symbols=USD`,
        { headers: { Accept: 'application/json' } }
    )
    if (!response.ok) {
        throw new Error(`Exchange rate request for ${currency} failed with ${response.status}`)
    }
    const latest: unknown = await response.json()
    Value.Assert(LatestRates, latest)
    const rate = latest.rates['USD']
    if (rate === undefined) {
        throw new Error(`No USD rate for ${currency}`)
    }
    return rate
}
