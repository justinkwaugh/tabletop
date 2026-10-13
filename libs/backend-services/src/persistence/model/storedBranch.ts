import { Type, type Static } from 'typebox'

export type StoredBranch = Static<typeof StoredBranch>
export const StoredBranch = Type.Object({
    data: Type.String()
})
