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
    worlds: Type.Array(WorldPlacement),
    anomaly: Type.Optional(Type.String()),
    anomalyResolved: Type.Optional(Type.Boolean())
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

// What a base produces in the campaign's base production (rulebook 4.4): cash or one tech type.
export const CASH_PRODUCTION = 'Cash'
export type Production = Type.Static<typeof Production>
export const Production = Type.Union([Type.Literal(CASH_PRODUCTION), Type.Enum(TechField)])

export type Base = Type.Static<typeof Base>
export const Base = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    settlements: Type.Number(),
    spent: Type.Number(),
    cloned: Type.Boolean(),
    production: Type.Optional(Production)
})

export function baseKey(playerId: string, systemId: string): string {
    return `${playerId}:${systemId}`
}

export type TechPools = Type.Static<typeof TechPools>
export const TechPools = Type.Object({
    [TechField.Biology]: Type.Array(Type.Number()),
    [TechField.Physics]: Type.Array(Type.Number()),
    [TechField.Engineering]: Type.Array(Type.Number())
})

export enum MarkerReason {
    Exploration = 'Exploration',
    Loss = 'Loss',
    Research = 'Research'
}

export enum OperationKind {
    Mining = 'Mining',
    Research = 'Research'
}

// A mining or research action this turn (rulebook 1.17), kept for the once-per-system limit and
// the Syndicate's take.
export type Operation = Type.Static<typeof Operation>
export const Operation = Type.Object({
    shipId: Type.String(),
    systemId: Type.String(),
    kind: Type.Enum(OperationKind)
})

export type EarnedMarkers = Type.Static<typeof EarnedMarkers>
export const EarnedMarkers = Type.Object({
    shipId: Type.String(),
    systemId: Type.String(),
    field: Type.Enum(TechField),
    count: Type.Number(),
    reason: Type.Enum(MarkerReason)
})

export type PendingSurvey = Type.Static<typeof PendingSurvey>
export const PendingSurvey = Type.Object({
    shipId: Type.String(),
    systemId: Type.String()
})

export type PendingAnomalyAttempt = Type.Static<typeof PendingAnomalyAttempt>
export const PendingAnomalyAttempt = Type.Object({
    systemId: Type.String(),
    anomalyId: Type.String(),
    shipIds: Type.Array(Type.String())
})

// Settlements an anomaly's reward gives, waiting to be placed (rulebook 1.16).
export type SettlementReward = Type.Static<typeof SettlementReward>
export const SettlementReward = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    settlements: Type.Number()
})

export type SurveyWorldChoice = Type.Static<typeof SurveyWorldChoice>
export const SurveyWorldChoice = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    drawnTileId: Type.String()
})

export type TerraformTarget = Type.Static<typeof TerraformTarget>
export const TerraformTarget = Type.Object({
    systemId: Type.String(),
    slot: Type.Number()
})

// A mining ship's terraforming action (rule 1.18), resolved once everyone has explored.
export type ShipTerraform = Type.Static<typeof ShipTerraform>
export const ShipTerraform = Type.Object({
    shipId: Type.String(),
    ...TerraformTarget.properties
})

export type TerraformRecord = Type.Static<typeof TerraformRecord>
export const TerraformRecord = Type.Object({
    playerId: Type.String(),
    ...TerraformTarget.properties
})

export type TerraformChoice = Type.Static<typeof TerraformChoice>
export const TerraformChoice = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    slot: Type.Number(),
    drawnTileIds: Type.Array(Type.String())
})
