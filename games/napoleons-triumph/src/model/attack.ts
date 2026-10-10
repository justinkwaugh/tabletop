import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'
import { Face } from '../components/pieces.js'
import { MachineState } from '../definition/states.js'

export enum CommandKind {
    Corps = 'Corps',
    Detach = 'Detach',
    Unit = 'Unit'
}

export type MoveOrder = Type.Static<typeof MoveOrder>
export const MoveOrder = Type.Object({
    kind: Type.Enum(CommandKind),
    commanderId: Type.Optional(Type.String()),
    unitIds: Type.Array(Type.String(), { minItems: 1 }),
    road: Type.Optional(Type.Array(Type.Integer())),
    entryId: Type.Optional(Type.String()),
    continues: Type.Optional(Type.Literal(true))
})

/**
 * A cavalry road move that took a locale the defender gave up without a fight and may still go on:
 * ride further, or threaten again across an approach its road crosses (rule 11).
 */
export type RoadMarch = Type.Static<typeof RoadMarch>
export const RoadMarch = Type.Object({
    kind: Type.Enum(CommandKind),
    commanderId: Type.Optional(Type.String()),
    unitIds: Type.Array(Type.String(), { minItems: 1 }),
    start: Type.Optional(Type.Integer()),
    entryId: Type.Optional(Type.String()),
    path: Type.Array(Type.Integer(), { minItems: 1 })
})

export enum DecisionKind {
    OddLoss = 'OddLoss',
    ExcessLosses = 'ExcessLosses',
    Regroup = 'Regroup',
    Advance = 'Advance'
}

export type OddLossDecision = Type.Static<typeof OddLossDecision>
export const OddLossDecision = Type.Object({
    kind: Type.Literal(DecisionKind.OddLoss),
    playerId: Type.String(),
    unitIds: Type.Array(Type.String(), { minItems: 2, maxItems: 2 })
})

export type ExcessLossesDecision = Type.Static<typeof ExcessLossesDecision>
export const ExcessLossesDecision = Type.Object({
    kind: Type.Literal(DecisionKind.ExcessLosses),
    playerId: Type.String(),
    amount: Type.Integer({ minimum: 1 }),
    unitIds: Type.Array(Type.String(), { minItems: 1 })
})

export type RegroupDecision = Type.Static<typeof RegroupDecision>
export const RegroupDecision = Type.Object({
    kind: Type.Literal(DecisionKind.Regroup),
    playerId: Type.String(),
    commanderIds: Type.Array(Type.String(), { minItems: 1 })
})

export type AdvanceDecision = Type.Static<typeof AdvanceDecision>
export const AdvanceDecision = Type.Object({
    kind: Type.Literal(DecisionKind.Advance),
    playerId: Type.String(),
    unitIds: Type.Array(Type.String(), { minItems: 1 })
})

export type PendingDecision = Type.Static<typeof PendingDecision>
export const PendingDecision = Type.Union([
    OddLossDecision,
    ExcessLossesDecision,
    RegroupDecision,
    AdvanceDecision
])

export type DefensePlan = Type.Static<typeof DefensePlan>
export const DefensePlan = Type.Object({
    playerId: Type.String(),
    leaderIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 2 }), {
        policy: Visibility.Policy.Owner
    })
})

/** The machine states an attack passes through (rule 11); the attack records which it is in. */
export type AttackStep = Type.Static<typeof AttackStep>
export const AttackStep = Type.Union([
    Type.Literal(MachineState.DefenseResponse),
    Type.Literal(MachineState.FeintDecision),
    Type.Literal(MachineState.AttackDeclaration),
    Type.Literal(MachineState.CounterAttackDecision),
    Type.Literal(MachineState.ResolvingAttack),
    Type.Literal(MachineState.Retreating),
    Type.Literal(MachineState.Occupying)
])

export type LossEntry = Type.Static<typeof LossEntry>
export const LossEntry = Type.Object({
    unitId: Type.String(),
    steps: Type.Integer(),
    eliminated: Type.Boolean(),
    face: Face
})

export type Attack = Type.Static<typeof Attack>
export const Attack = Type.Object({
    step: AttackStep,
    attackerId: Type.String(),
    defenderId: Type.String(),
    attackApproach: Type.Integer(),
    defenseApproach: Type.Integer(),
    guardAttack: Type.Optional(Type.Literal(true)),
    defendingUnitIds: Type.Array(Type.String()),
    defendingCommanderIds: Type.Array(Type.String()),
    defendersBlocking: Type.Optional(Type.Boolean()),
    defensePlan: Type.Optional(DefensePlan),
    defenseLeaderIds: Type.Array(Type.String()),
    orders: Type.Array(MoveOrder),
    attackingUnitIds: Type.Array(Type.String()),
    attackingCommanderIds: Type.Array(Type.String()),
    wide: Type.Optional(Type.Boolean()),
    attackLeaderIds: Type.Array(Type.String()),
    counterAttackerIds: Type.Array(Type.String()),
    initialResult: Type.Optional(Type.Integer()),
    finalResult: Type.Optional(Type.Integer()),
    attackerWon: Type.Optional(Type.Boolean()),
    artilleryLed: Type.Optional(Type.Boolean()),
    retreatBeforeCombat: Type.Optional(Type.Literal(true)),
    feint: Type.Optional(Type.Literal(true)),
    attackerStepsLost: Type.Integer({ minimum: 0 }),
    defenderStepsLost: Type.Integer({ minimum: 0 }),
    lossesSettled: Type.Optional(Type.Literal(true)),
    pending: Type.Array(PendingDecision)
})
