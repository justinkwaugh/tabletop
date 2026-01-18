import { OffsetCoordinates } from '@tabletop/common'
import * as Type from 'typebox'
export type ChainEntry = Type.Static<typeof ChainEntry>
export const ChainEntry = Type.Object({
    coords: OffsetCoordinates,
    sundiverId: Type.Optional(Type.String())
})

export type SundiverChain = Type.Static<typeof SundiverChain>
export const SundiverChain = Type.Array(ChainEntry)
