import { Type, type Static } from '@sinclair/typebox'

export type StoredState = Static<typeof StoredState>
export const StoredState = Type.Object({
    data: Type.String()
})
