import { Type, type TSchema } from 'typebox'

export const Nullable = <T extends TSchema>(schema: T) => Type.Union([Type.Null(), schema])
