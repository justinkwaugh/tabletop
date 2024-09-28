import { Type, type Static } from '@sinclair/typebox'
import { Company } from '../definition/companies.js'

export type Cube = Static<typeof Cube>
export const Cube = Type.Object({
    value: Type.Number(),
    company: Type.Enum(Company)
})
