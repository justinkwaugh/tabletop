import { CharityTally, CurrencyCode } from '@tabletop/common'
import { Type, type Static } from 'typebox'

export const StoredCharityTally = Type.Object({
    tally: CharityTally,
    usdPerUnit: Type.Record(CurrencyCode, Type.Number()),
    refreshedAt: Type.String()
})
export type StoredCharityTally = Static<typeof StoredCharityTally>
