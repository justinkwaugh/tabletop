import * as Type from 'typebox'
import { CompanyId } from '../components/companies.js'

export type CompanyState = Type.Static<typeof CompanyState>
export const CompanyState = Type.Object({
    id: Type.Enum(CompanyId),
    treasury: Type.Number(),
    // One entry per share held by a player, naming that player.
    owners: Type.Array(Type.String())
})

export type PlacedCube = Type.Static<typeof PlacedCube>
export const PlacedCube = Type.Object({
    hexId: Type.String(),
    companyId: Type.Enum(CompanyId)
})

// The Streamside Sisters share buyer who may place a cube before play continues.
export type BonusCube = Type.Static<typeof BonusCube>
export const BonusCube = Type.Object({
    playerId: Type.String(),
    initialAuction: Type.Boolean()
})
