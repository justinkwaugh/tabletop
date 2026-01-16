import * as Type from 'typebox'

export type ActionGroup = Type.Static<typeof ActionGroup>
export const ActionGroup = Type.Object({
    type: Type.String(),
    start: Type.Number(),
    end: Type.Optional(Type.Number())
})
