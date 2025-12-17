import { OffsetCoordinates } from '@tabletop/common'
import Type, { Static } from 'typebox'

export type ChainEntry = Static<typeof ChainEntry>
export const ChainEntry = Type.Object({
    coords: OffsetCoordinates,
    sundiverId: Type.Optional(Type.String())
})

export type SundiverChain = Static<typeof SundiverChain>
export const SundiverChain = Type.Array(ChainEntry)
