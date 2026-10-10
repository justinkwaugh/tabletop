import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'

export enum CommandKind {
    Corps = 'Corps',
    Detach = 'Detach',
    Unit = 'Unit'
}

/** One command and the pieces it moves. A road move lists the locales it enters in order. */
export type MoveOrder = Type.Static<typeof MoveOrder>
export const MoveOrder = Type.Object({
    kind: Type.Enum(CommandKind),
    commanderId: Type.Optional(Type.String()),
    unitIds: Type.Array(Type.String(), { minItems: 1 }),
    road: Type.Optional(Type.Array(Type.Integer(), { minItems: 1 })),
    entryId: Type.Optional(Type.String())
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

/** The defender's choice of leading units, kept from the attacker until the attack is pressed. */
export type DefensePlan = Type.Static<typeof DefensePlan>
export const DefensePlan = Type.Object({
    playerId: Type.String(),
    leaderIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 2 }), {
        policy: Visibility.Policy.Owner
    })
})

/** Where the attack procedure of rule 11 stands. */
export enum AttackStep {
    DefenseResponse = 'DefenseResponse',
    FeintDecision = 'FeintDecision',
    AttackDeclaration = 'AttackDeclaration',
    CounterAttackDecision = 'CounterAttackDecision',
    Resolving = 'Resolving',
    Retreating = 'Retreating',
    Occupying = 'Occupying'
}

export type Attack = Type.Static<typeof Attack>
export const Attack = Type.Object({
    step: Type.Enum(AttackStep),
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
    /** Strength points each army has lost in this attack so far. */
    attackerStepsLost: Type.Integer({ minimum: 0 }),
    defenderStepsLost: Type.Integer({ minimum: 0 }),
    /** Set once the losses of steps 9 and 10 are fully applied and morale has been adjusted. */
    lossesSettled: Type.Optional(Type.Literal(true)),
    pending: Type.Array(PendingDecision)
})
