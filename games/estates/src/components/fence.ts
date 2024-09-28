import { Type, type Static } from '@sinclair/typebox'

export type Fence = Static<typeof Fence>
export const Fence = Type.Object({
    value: Type.Number()
})
