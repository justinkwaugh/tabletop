import * as Type from 'typebox'

export const Nullable = <T extends Type.TSchema>(schema: T) => Type.Union([Type.Null(), schema])
