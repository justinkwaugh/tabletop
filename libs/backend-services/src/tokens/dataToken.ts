import { type Static, Type } from '@sinclair/typebox'

export type DataToken = Static<typeof DataToken>
export const DataToken = Type.Object({
    id: Type.String(),
    expiration: Type.Date(),
    type: Type.String(),
    data: Type.Any(),
    createdAt: Type.Optional(Type.Date()),
    updatedAt: Type.Optional(Type.Date())
})
