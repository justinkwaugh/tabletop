import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { CompanyId } from '../components/companies.js'

export type CompanyState = Type.Static<typeof CompanyState>
export const CompanyState = Type.Object({
    id: Type.Enum(CompanyId),
    treasury: Type.Number(),
    owners: Type.Array(Type.String())
})

export type PlacedCube = Type.Static<typeof PlacedCube>
export const PlacedCube = Type.Object({
    coords: AxialCoordinates,
    companyId: Type.Enum(CompanyId)
})

export type BonusCube = Type.Static<typeof BonusCube>
export const BonusCube = Type.Object({
    playerId: Type.String(),
    initialAuction: Type.Boolean()
})
