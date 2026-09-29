import * as Type from 'typebox'
import { Banner } from './oathEnums.js'

/** R-5.1.4.IV */
export type ConspiracyTake = Type.Static<typeof ConspiracyTake>
export const ConspiracyTake = Type.Union([
    Type.Object({ kind: Type.Literal('relic'), cardId: Type.String() }),
    Type.Object({ kind: Type.Literal('banner'), banner: Type.Enum(Banner) })
])

export type ConspiracyPlay = Type.Static<typeof ConspiracyPlay>
export const ConspiracyPlay = Type.Object({
    targetPlayerId: Type.String(),
    take: ConspiracyTake
})
