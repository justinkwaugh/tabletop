import { type Static, Type } from 'typebox'
import { DateType } from '@tabletop/common'

export type DataToken = Static<typeof DataToken>
export const DataToken = Type.Object({
    id: Type.String(),
    expiration: DateType(),
    type: Type.String(),
    data: Type.Any(),
    createdAt: Type.Optional(DateType()),
    updatedAt: Type.Optional(DateType())
})
