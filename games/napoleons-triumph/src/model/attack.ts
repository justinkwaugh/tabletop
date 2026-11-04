import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'
import { Face } from '../components/pieces.js'
import type { MachineState } from '../definition/states.js'

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

/** Rule 11: cavalry that took a locale by road without a fight may still go on with its move. */
export type RoadMarch = Type.Static<typeof RoadMarch>
export const RoadMarch = Type.Object({
    kind: Type.Enum(CommandKind),
    commanderId: Type.Optional(Type.String()),
    unitIds: Type.Array(Type.String(), { minItems: 1 }),
    start: Type.Optional(Type.Integer()),
    /** Rule 10: the roads of the start locale the cavalry could leave by, having come there by road this turn. */
    startRoads: Type.Optional(Type.Array(Type.Integer())),
    entryId: Type.Optional(Type.String()),
    path: Type.Array(Type.Integer(), { minItems: 1 }),
    /** Rule 10 and its rulings: a stopped move enters no further locale and threatens nothing, but may still end blocking an approach its road crosses. */
    stopped: Type.Optional(Type.Literal(true))
})

/**
 * Rule 11: cavalry still riding when its turn ended, turned face-up then and kept so, with the
 * blocks it stands among, until the opponent has seen it; only then are those blocks shuffled.
 */
export type RevealedRide = Type.Static<typeof RevealedRide>
export const RevealedRide = Type.Object({
    unitIds: Type.Array(Type.String(), { minItems: 1 })
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

export type LossDecision = OddLossDecision | ExcessLossesDecision

export type PendingDecision = Type.Static<typeof PendingDecision>
export const PendingDecision = Type.Union([
    OddLossDecision,
    ExcessLossesDecision,
    RegroupDecision,
    AdvanceDecision
])

/** Rule 11, step 1: the command behind a threat is not announced. */
export type ThreatOrder = Type.Static<typeof ThreatOrder>
export const ThreatOrder = Type.Object({
    kind: Type.Enum(CommandKind),
    unitIds: Type.Array(Type.String(), { minItems: 1 }),
    /** Cavalry riding on by road that means to go on under the command it rides by, not a new one. */
    continues: Type.Optional(Type.Literal(true))
})

/** Rule 11, step 5: the declaration is free to differ from what the attacker had in mind. */
export type AttackPlan = Type.Static<typeof AttackPlan>
export const AttackPlan = Type.Object({
    playerId: Type.String(),
    order: Visibility.protect(ThreatOrder, { policy: Visibility.Policy.Owner })
})

/** Rule 11: whose answer the attack waits for once the defending pieces are named. */
export enum DefenseAwaits {
    /** Step 3: the attacker presses the attack or calls it a feint. */
    Feint = 'Feint',
    /** Step 4: the defender names the leading units, which are then turned face-up. */
    Leaders = 'Leaders'
}

/** Kept for attacks declared when the leading units were named with the defending pieces and held back until the attack was pressed. */
export type DefensePlan = Type.Static<typeof DefensePlan>
export const DefensePlan = Type.Object({
    playerId: Type.String(),
    leaderIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 2 }), {
        policy: Visibility.Policy.Owner
    })
})

export type AttackStep =
    | MachineState.DefenseResponse
    | MachineState.FeintDecision
    | MachineState.DefenseDeclaration
    | MachineState.AttackDeclaration
    | MachineState.CounterAttackDecision
    | MachineState.ResolvingAttack
    | MachineState.Retreating
    | MachineState.Occupying

export type LossEntry = Type.Static<typeof LossEntry>
export const LossEntry = Type.Object({
    unitId: Type.String(),
    steps: Type.Integer(),
    eliminated: Type.Boolean(),
    face: Face
})

export enum MoralePenaltyKind {
    HeavyCavalryCommitted = 'HeavyCavalryCommitted',
    GuardCommitted = 'GuardCommitted',
    GuardAttackDefeated = 'GuardAttackDefeated'
}

/** Rule 15: morale an army pays beyond its losses, as the amount its morale actually fell. */
export type MoralePenalty = Type.Static<typeof MoralePenalty>
export const MoralePenalty = Type.Object({
    playerId: Type.String(),
    kind: Type.Enum(MoralePenaltyKind),
    moraleLost: Type.Integer({ minimum: 0 })
})

export enum ResultTermKind {
    AttackLeaders = 'AttackLeaders',
    InfantryAgainstBlockers = 'InfantryAgainstBlockers',
    ApproachPenalty = 'ApproachPenalty',
    DefenseLeaders = 'DefenseLeaders',
    GuardAttack = 'GuardAttack',
    ArtilleryLeads = 'ArtilleryLeads',
    CounterAttack = 'CounterAttack'
}

/** Rule 11, steps 6 and 8: one thing counted towards an attack's result, what it added, and the units it counted as they then were. */
export type ResultTerm = Type.Static<typeof ResultTerm>
export const ResultTerm = Type.Object({
    kind: Type.Enum(ResultTermKind),
    value: Type.Integer(),
    faces: Type.Optional(Type.Array(Face))
})

export type Attack = Type.Static<typeof Attack>
export const Attack = Type.Object({
    attackerId: Type.String(),
    defenderId: Type.String(),
    attackApproach: Type.Integer(),
    defenseApproach: Type.Integer(),
    guardAttack: Type.Optional(Type.Literal(true)),
    attackPlan: Type.Optional(AttackPlan),
    defendingUnitIds: Type.Array(Type.String()),
    defendingCommanderIds: Type.Array(Type.String()),
    defendersBlocking: Type.Optional(Type.Boolean()),
    defensePlan: Type.Optional(DefensePlan),
    awaits: Type.Optional(Type.Enum(DefenseAwaits)),
    defenseLeaderIds: Type.Array(Type.String()),
    orders: Type.Array(MoveOrder),
    attackingUnitIds: Type.Array(Type.String()),
    attackingCommanderIds: Type.Array(Type.String()),
    wide: Type.Optional(Type.Boolean()),
    attackLeaderIds: Type.Array(Type.String()),
    counterAttackingUnitIds: Type.Array(Type.String()),
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
