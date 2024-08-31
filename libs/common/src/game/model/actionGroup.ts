import { Type, type Static } from '@sinclair/typebox'

export type ActionGroup = Static<typeof ActionGroup>
export const ActionGroup = Type.Object({
    type: Type.String(),
    start: Type.Number(),
    end: Type.Optional(Type.Number())
})
