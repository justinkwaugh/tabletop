import { Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import {
    ComponentCount,
    GoodCounts,
    GuildIdSchema,
    MonsterIdSchema,
    PawnNumberSchema,
    SpaceIdSchema,
    VesselTypeSchema,
    WritIdSchema
} from './stateSchemas.js'

/** A decision the current card leaves. A short ordered list; no follow-up opens another card. */
export type FollowUp = Type.Static<typeof FollowUp>
export const FollowUp = Type.Union([
    /** R-3.10, R-4.4.1 */
    Type.Object({ kind: Type.Literal('keep-writs'), playerId: Type.String() }),
    /** R-4.7 */
    Type.Object({ kind: Type.Literal('reeve'), playerId: Type.String(), guildId: GuildIdSchema }),
    /** R-4.9.1 */
    Type.Object({ kind: Type.Literal('military'), playerId: Type.String() }),
    /** R-3.7.5 */
    Type.Object({ kind: Type.Literal('voyage'), playerId: Type.String() }),
    /** R-3.11.3 */
    Type.Object({ kind: Type.Literal('inspect-harvest'), playerId: Type.String() })
])

/** A pawn is (playerId, n); a monster is its id. */
export type PieceRef = Type.Static<typeof PieceRef>
export const PieceRef = Type.Union([
    Type.Object({
        kind: Type.Literal('pawn'),
        playerId: Type.String(),
        n: PawnNumberSchema
    }),
    Type.Object({ kind: Type.Literal('monster'), monsterId: MonsterIdSchema })
])

export type WritDrawSource = Type.Static<typeof WritDrawSource>
export const WritDrawSource = Type.Union([
    Type.Literal('explore'),
    Type.Literal('shovels'),
    Type.Literal('pull'),
    Type.Literal('voyage')
])

/** R-3.13.2 Which of a player's markers a Starve the People aims at. */
export type StarveRole = Type.Static<typeof StarveRole>
export const StarveRole = Type.Union([Type.Literal('subject'), Type.Literal('serf')])

/** What is pending and who decides it. Every entry names its seats in public state. */
/** R-3.13.1 What a Conquer aims at. */
export type CombatTarget = Type.Static<typeof CombatTarget>
export const CombatTarget = Type.Union([PieceRef, Type.Object({ kind: Type.Literal('feudum') })])

/** R-4.11.2 The epochs a round can trigger; the game starts in the first. */
export type TriggeredEpoch = Type.Static<typeof TriggeredEpoch>
export const TriggeredEpoch = Type.Union([
    Type.Literal(2),
    Type.Literal(3),
    Type.Literal(4),
    Type.Literal(5)
])

export type FlowState = Type.Static<typeof FlowState>
export const FlowState = Type.Object({
    /** R-1.4.8, R-1.4.9 The seat choosing. */
    setupOrder: Type.Optional(Type.Object({ playerId: Type.String() })),
    /** R-3.1-H1 The seats already final, in the order they finalised; the rest may finalise now. */
    selection: Type.Optional(Type.Object({ finalised: Type.Array(Type.String()) })),
    /** R-3.2, R-3.3 The turn player, and what the current card still leaves in order. */
    turn: Type.Optional(
        Type.Object({
            playerId: Type.String(),
            secondCard: Type.Boolean(),
            followUps: Type.Array(FollowUp),
            /** R-4.2.2, R-4.2-H2 Each vessel left on a space this turn, boarded only on a later turn. */
            vesselsLeft: Type.Optional(
                Type.Array(Type.Object({ spaceId: SpaceIdSchema, vessel: VesselTypeSchema }))
            )
        })
    ),
    /** R-3.10, R-4.4.1 `drawn` is owner-known; the count is public. */
    writDraw: Type.Optional(
        Type.Object({
            playerId: Type.String(),
            drawnCount: ComponentCount,
            keep: ComponentCount,
            source: WritDrawSource,
            shovelsOffered: Type.Boolean(),
            drawn: Visibility.protect(Type.Array(WritIdSchema), {
                policy: Visibility.Policy.Owner
            })
        })
    ),
    /** R-3.11.3 The goods wait here, drawn from the haversack, until the favours are chosen. */
    harvest: Type.Optional(
        Type.Object({
            playerId: Type.String(),
            spaceId: SpaceIdSchema,
            drawn: GoodCounts,
            favours: ComponentCount
        })
    ),
    /** R-4.8.1 The attacker names a target; the defender answers. */
    combat: Type.Optional(
        Type.Object({
            attackerId: Type.String(),
            defenderId: Type.String(),
            spaceId: SpaceIdSchema,
            target: CombatTarget,
            defendFlipped: Type.Boolean()
        })
    ),
    /** R-3.13, R-3.14.2 */
    starve: Type.Optional(
        Type.Object({
            actorId: Type.String(),
            targetPlayerId: Type.String(),
            spaceId: SpaceIdSchema,
            role: StarveRole
        })
    ),
    /** R-4.10 In turn order. */
    nourish: Type.Optional(Type.Object({ pending: Type.Array(Type.String()) })),
    /** R-4.3.4, R-4.12.3 In turn order. */
    landscapes: Type.Optional(Type.Object({ pending: Type.Array(Type.String()) })),
    /** R-4.11-H1 Set at step 4 of the round. */
    epochTriggered: Type.Optional(TriggeredEpoch)
})
