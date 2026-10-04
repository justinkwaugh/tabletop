import * as Type from 'typebox'
import { TechField } from '../components/techFields.js'
import { WorldSide } from '../components/worlds.js'

export type WorldPlacement = Type.Static<typeof WorldPlacement>
export const WorldPlacement = Type.Object({
    tileId: Type.String(),
    side: Type.Enum(WorldSide)
})

export type SystemState = Type.Static<typeof SystemState>
export const SystemState = Type.Object({
    systemId: Type.String(),
    explorationMarker: Type.Number(),
    worlds: Type.Array(WorldPlacement)
})

export type ShipState = Type.Static<typeof ShipState>
export const ShipState = Type.Object({
    shipId: Type.String(),
    playerId: Type.String(),
    systemId: Type.String(),
    transit: Type.Number(),
    damage: Type.Number(),
    settlements: Type.Number(),
    loadedFromBase: Type.Boolean(),
    explored: Type.Boolean()
})

export type Base = Type.Static<typeof Base>
export const Base = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    settlements: Type.Number(),
    spent: Type.Number(),
    cloned: Type.Boolean()
})

export type TechPools = Type.Static<typeof TechPools>
export const TechPools = Type.Object({
    [TechField.Biology]: Type.Array(Type.Number()),
    [TechField.Physics]: Type.Array(Type.Number()),
    [TechField.Engineering]: Type.Array(Type.Number())
})

export type PendingSurvey = Type.Static<typeof PendingSurvey>
export const PendingSurvey = Type.Object({
    playerId: Type.String(),
    shipId: Type.String(),
    systemId: Type.String()
})

export type SurveyWorldChoice = Type.Static<typeof SurveyWorldChoice>
export const SurveyWorldChoice = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    drawnTileId: Type.String()
})

export type TerraformChoice = Type.Static<typeof TerraformChoice>
export const TerraformChoice = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    slot: Type.Number(),
    drawnTileIds: Type.Array(Type.String())
})
