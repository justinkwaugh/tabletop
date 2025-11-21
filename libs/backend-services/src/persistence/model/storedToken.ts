import { Type, type Static } from 'typebox'
import { DataToken } from '../../tokens/dataToken.js'

export type StoredDataToken = Static<typeof StoredDataToken>
export const StoredDataToken = Type.Evaluate(
    Type.Intersect([
        Type.Omit(DataToken, ['createdAt', 'updatedAt', 'expiration']),
        Type.Object({
            createdAt: Type.Optional(Type.Any()),
            updatedAt: Type.Optional(Type.Any()),
            expiration: Type.Any()
        })
    ])
)
