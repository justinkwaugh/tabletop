import { Type, type Static } from '@sinclair/typebox'

export type Roof = Static<typeof Roof>
export const Roof = Type.Object({
    value: Type.Number()
})
