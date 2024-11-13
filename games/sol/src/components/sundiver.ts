import { Static, Type } from '@sinclair/typebox'

export type Sundiver = Static<typeof Sundiver>
export const Sundiver = Type.Object({
    id: Type.String(),
    playerId: Type.String()
})
