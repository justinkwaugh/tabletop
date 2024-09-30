import { Type, type Static } from '@sinclair/typebox'
import { Company } from '../definition/companies.js'
import { PieceType } from './pieceType.js'

export type Cube = Static<typeof Cube>
export const Cube = Type.Object({
    pieceType: Type.Literal(PieceType.Cube),
    value: Type.Number(),
    company: Type.Enum(Company)
})
