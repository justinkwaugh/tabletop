import { Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { GuildById, PullReward, PushVp } from '../data/guilds.js'
import type { GuildId } from '../data/components.js'
import type { SealId } from '../data/seals.js'
import type { WritId } from '../data/writs.js'
import {
    drawWritsToKeep,
    queueFollowUp,
    reasonDiscRefused,
    reevePointsIn,
    requireDrawnWrits
} from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { rankOf, RankChange } from '../model/guildStatus.js'
import {
    GoodSchema,
    MonsterIdSchema,
    ScrollSpaceIdSchema,
    SpaceIdSchema,
    SulfurToBarrelCount,
    VesselTypeSchema,
    WritIdSchema
} from '../model/stateSchemas.js'
import { writDeckCount } from '../model/writDeck.js'
import { CompletionCount, GuildFunctionDetails, InventionChoice } from './guildFunctionDetails.js'

export const GuildFunctionNames = ['trade', 'pull', 'push'] as const
export type GuildFunctionName = (typeof GuildFunctionNames)[number]

/** R-3.16.1 */
export const GuildFunctionSchema = Type.Enum(GuildFunctionNames)

/**
 * R-3.16, R-4.6 What a guild function's input may carry; each function reads its own. A guild
 * function adds its fields here, each optional, and refuses in `reasonRefused` what it lacks.
 */
export type GuildFunctionParams = Type.Static<typeof GuildFunctionParams>
export const GuildFunctionParams = Type.Object({
    /** R-4.6.3 Farmer trade: the ruled farm whose goods go to the barn. */
    farmSpaceId: Type.Optional(SpaceIdSchema),
    /** R-4.6.3 Farmer trade: how many rewards are food; the rest are shillings. */
    takeFood: Type.Optional(Type.Integer({ minimum: 0 })),
    /** R-4.6.1 The goods moved, in order. */
    goods: Type.Optional(Type.Array(GoodSchema)),
    /** R-4.6.3, R-4.10.2 Merchant trade: of the sulfur bought, how many go in the barrel. */
    sulfurToBarrel: Type.Optional(SulfurToBarrelCount),
    /** R-4.6.1 Rows or columns; absent, whichever is higher. */
    count: Type.Optional(CompletionCount),
    /** R-4.6.3 Alchemist trade: the vessel bought. */
    vesselType: Type.Optional(VesselTypeSchema),
    /** R-4.6.5 Alchemist push: what is invented, in order; barrels are priced in this order. */
    inventions: Type.Optional(Type.Array(InventionChoice)),
    /** R-4.6.3 Knight trade: the monster tamed, if any, and the space it deploys to. */
    monster: Type.Optional(MonsterIdSchema),
    deploySpaceId: Type.Optional(SpaceIdSchema),
    /** R-4.6.4, R-4.6.5 Knight push, Noble pull: each marker's row, by its place among the rows. */
    knightRows: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }))),
    /** R-4.6-H1, R-4.6.4, R-4.6.5 The scroll spaces filled or emptied, in order. */
    scrollSpaces: Type.Optional(Type.Array(ScrollSpaceIdSchema))
})

/**
 * Who performs a function. A Guild card's seat performs its own; `feastOf` names the opponent whose
 * rank a Feast borrows (R-3.16.3), so a function reads the rank and the share through this.
 */
export interface FunctionActor {
    readonly playerId: string
    readonly feastOf?: string
}

/** R-4.6.5 A purse or coffer split between the guild's members; `stays` is left in the pot. */
export type PotSplit = Type.Static<typeof PotSplit>
export const PotSplit = Type.Object({
    pot: Type.String(),
    shares: Type.Array(
        Type.Object({ playerId: Type.String(), amount: Type.Integer({ minimum: 0 }) })
    ),
    stays: Type.Integer({ minimum: 0 })
})

/** R-4.6.2 `payGuild`'s split, recorded when a function has a price. */
export type PaymentSplit = Type.Static<typeof PaymentSplit>
export const PaymentSplit = Type.Object({
    members: Type.Array(
        Type.Object({ playerId: Type.String(), amount: Type.Integer({ minimum: 0 }) })
    ),
    charity: Type.Object({ id: Type.String(), amount: Type.Integer({ minimum: 0 }) }),
    generalSupply: Type.Integer({ minimum: 0 })
})

/** R-4.6, R-4.7 What every guild function records. */
export type GuildFunctionOutcome = Type.Static<typeof GuildFunctionOutcome>
export const GuildFunctionOutcome = Type.Object({
    details: GuildFunctionDetails,
    /** R-4.6.1 Absent for a function with no level. */
    completions: Type.Optional(Type.Integer({ minimum: 0 })),
    points: Type.Integer({ minimum: 0 }),
    /** R-4.7 Scored in this Action, by a reeve already on the marker. */
    reevePoints: Type.Integer({ minimum: 0 }),
    /** R-4.7 A disc follow-up was queued. */
    reeveOffered: Type.Boolean(),
    split: Type.Optional(PotSplit),
    payment: Type.Optional(PaymentSplit),
    /** R-4.6.4, R-4.4-H2 Writs drawn and how many to keep; the table sees these. */
    drawnCount: Type.Optional(Type.Integer({ minimum: 0 })),
    keep: Type.Optional(Type.Integer({ minimum: 0 })),
    /** R-4.6.4 Actor-known; empty when nothing was drawn. */
    drawnWritIds: Visibility.protect(Type.Array(WritIdSchema), {
        policy: Visibility.Policy.Actor
    }),
    rankChanges: Type.Array(RankChange)
})

/** What a function's own rule did, before the base scores it. */
export interface PerformedFunction {
    readonly details: GuildFunctionDetails
    readonly completions?: number
    readonly split?: PotSplit
    readonly payment?: PaymentSplit
    /** R-X.2 It drew from a hidden source, or at random. */
    readonly revealed?: boolean
}

/** R-4.6.3 What a Farmer trade would do with this input. */
export interface TradePreview {
    readonly sent: number
    readonly food: number
    readonly shillings: number
    readonly surplus: number
    readonly spill: number
    readonly toBarn: number
}

/** R-4.6-H2 What a function drawing a bead shows: both beads, and the outcome if it is the low. */
export interface BeadDrawPreview {
    readonly high: SealId
    readonly low: SealId
    readonly ifLow: ScoringPreview
}

/** R-4.6.5 What a flip can reach: the seals are unseen, so its lowest and highest totals. */
export interface SealFlipPreview {
    readonly rosaryTotal: number
    readonly flips: number
    readonly lowestTotal: number
    readonly highestTotal: number
    readonly ifLowest: ScoringPreview
}

/** What a function's own rule says it would do. A function adds its optional facts here. */
export interface PreviewedFunction {
    readonly completions?: number
    readonly rows?: number
    readonly columns?: number
    readonly split?: PotSplit
    readonly payment?: PaymentSplit
    readonly revealed?: boolean
    readonly trade?: TradePreview
    readonly beadDraw?: BeadDrawPreview
    readonly sealFlip?: SealFlipPreview
    /** What it would record, for a function that draws nothing and whose record says it all. */
    readonly details?: GuildFunctionDetails
}

/**
 * One row of the registry: everything one guild function of one guild knows. `reasonClosed` is
 * whether it can happen at all, input aside; `reasonRefused` adds the input, and is only read when
 * `reasonClosed` is clear. `preview` must not read the vault or the protected stream, and gives
 * undefined for an input that cannot happen; a staged input short of legal is still read.
 */
export interface GuildFunctionRow {
    reasonClosed(state: HydratedFeudumGameState, actor: FunctionActor): string | undefined
    reasonRefused(
        state: HydratedFeudumGameState,
        actor: FunctionActor,
        params: GuildFunctionParams
    ): string | undefined
    perform(
        state: HydratedFeudumGameState,
        actor: FunctionActor,
        params: GuildFunctionParams
    ): PerformedFunction
    preview(
        state: HydratedFeudumGameState,
        actor: FunctionActor,
        params: GuildFunctionParams
    ): PreviewedFunction | undefined
    /** R-4.6.1 The most completions it can reach now, for the offer's "up to". */
    bestCompletions?(state: HydratedFeudumGameState, actor: FunctionActor): number
}

/** R-4.6.4, R-4.6.5 3 vp for a pull at its threshold; 4/5/6 for a push's 1/2/3 completions. */
export function pointsFor(fn: GuildFunctionName, completions: number): number {
    if (fn === 'trade' || completions <= 0) {
        return 0
    }
    return fn === 'pull' ? PullReward.vp : PushVp[Math.min(completions, PushVp.length) - 1]
}

export interface ScoredFunction {
    readonly points: number
    readonly reevePoints: number
    readonly reeveOffered: boolean
    readonly drawnCount?: number
    readonly keep?: number
    readonly drawnWritIds: WritId[]
}

/**
 * R-4.6.1, R-4.6.4, R-4.6.5, R-4.7, R-4.7-H1 Points, reeve and writs for the level reached. Below a
 * threshold nothing scores. A reeve already there scores now; otherwise one is offered, and scores
 * when placed. R-3.16.3 A Feast scores no reeve. A pull's keep comes ahead of the reeve.
 */
export function scoreFunction(
    state: HydratedFeudumGameState,
    actor: FunctionActor,
    guildId: GuildId,
    fn: GuildFunctionName,
    completions: number
): ScoredFunction {
    const points = pointsFor(fn, completions)
    if (points === 0) {
        return { points, reevePoints: 0, reeveOffered: false, drawnWritIds: [] }
    }
    const player = state.getPlayerState(actor.playerId)
    player.score += points

    const reevePoints = actor.feastOf ? 0 : reevePointsIn(state, actor.playerId, guildId)
    player.score += reevePoints
    const followUp = { kind: 'reeve', playerId: actor.playerId, guildId } as const
    const reeveOffered =
        !actor.feastOf && reevePoints === 0 && reasonDiscRefused(state, followUp) === undefined
    if (reeveOffered) {
        queueFollowUp(state, followUp)
    }
    if (fn !== 'pull') {
        return { points, reevePoints, reeveOffered, drawnWritIds: [] }
    }
    const drawnCount = drawWritsToKeep(state, actor.playerId, PullReward.writs, 'pull')
    const { writDraw } = state.flow
    return {
        points,
        reevePoints,
        reeveOffered,
        drawnCount,
        keep: drawnCount > 0 && writDraw ? writDraw.keep : 0,
        drawnWritIds: drawnCount > 0 && writDraw ? [...requireDrawnWrits(writDraw)] : []
    }
}

export interface ScoringPreview {
    readonly completions: number
    readonly points: number
    /** R-4.7 What the reeve scores, already there or if the one offered is placed. */
    readonly reevePoints: number
    readonly reeveOffered: boolean
    readonly drawnCount: number
    /** R-4.6.4, R-4.4-H2 How many of the drawn writs the seat keeps. */
    readonly keep: number
}

/** R-4.7, R-4.6.4 `scoreFunction` read without changing or drawing anything. */
export function scoringPreview(
    state: HydratedFeudumGameState,
    actor: FunctionActor,
    guildId: GuildId,
    fn: GuildFunctionName,
    completions: number
): ScoringPreview {
    const points = pointsFor(fn, completions)
    const drawnCount =
        points > 0 && fn === 'pull' ? Math.min(PullReward.writs.draw, writDeckCount(state)) : 0
    const keep = Math.min(PullReward.writs.keep, drawnCount)
    if (points === 0 || actor.feastOf) {
        return { completions, points, reevePoints: 0, reeveOffered: false, drawnCount, keep }
    }
    const reevePoints = reevePointsIn(state, actor.playerId, guildId)
    if (reevePoints > 0) {
        return { completions, points, reevePoints, reeveOffered: false, drawnCount, keep }
    }
    const reeveOffered =
        reasonDiscRefused(state, { kind: 'reeve', playerId: actor.playerId, guildId }) === undefined
    return {
        completions,
        points,
        reevePoints: reeveOffered ? placedReevePoints(state, actor.playerId) : 0,
        reeveOffered,
        drawnCount,
        keep
    }
}

/** R-4.7 A reeve placed here scores 1, and 1 more with the other reeve elsewhere. */
function placedReevePoints(state: HydratedFeudumGameState, playerId: string): number {
    const elsewhere = Object.values(state.guilds.tracks).some((track) => {
        const rank = rankOf(track, playerId)
        return rank && track[rank]?.reeve
    })
    return elsewhere ? 2 : 1
}

/**
 * R-4.6.5 A pot splits between master and journeyman, the odd shilling to the master. A missing
 * member's half stays. R-3.16.3 On a Feast, the opponent's share goes to the actor. The caller sets
 * the pot to `stays`.
 */
export function splitPot(
    state: HydratedFeudumGameState,
    pot: string,
    amount: number,
    guildId: GuildId,
    actor: FunctionActor
): PotSplit {
    const { master, journeyman } = state.guilds.tracks[guildId]
    const halves = [
        { member: master?.playerId, amount: Math.ceil(amount / 2) },
        { member: journeyman?.playerId, amount: Math.floor(amount / 2) }
    ]
    const shares = halves.flatMap(({ member, amount: share }) => {
        if (member === undefined) {
            return []
        }
        const playerId = member === actor.feastOf ? actor.playerId : member
        state.getPlayerState(playerId).shillings += share
        return [{ playerId, amount: share }]
    })
    const paid = shares.reduce((sum, share) => sum + share.amount, 0)
    return { pot, shares, stays: amount - paid }
}

/** R-3.16.2 Each guild once a round, feasts included. */
export function reasonGuildUsedRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    guildId: GuildId
): string | undefined {
    return state.getPlayerState(playerId).guildsUsed.includes(guildId)
        ? `You have already used the ${GuildById[guildId].name} Guild this round.`
        : undefined
}

/** R-3.16.2 */
export function markGuildUsed(
    state: HydratedFeudumGameState,
    playerId: string,
    guildId: GuildId
): void {
    state.getPlayerState(playerId).guildsUsed.push(guildId)
}

/** R-3.16.1 Trade for anyone, pull for its journeyman, push for its master. */
export function reasonRankRefused(
    state: HydratedFeudumGameState,
    actor: FunctionActor,
    guildId: GuildId,
    fn: GuildFunctionName
): string | undefined {
    const rank = rankOf(state.guilds.tracks[guildId], actor.feastOf ?? actor.playerId)
    const { name } = GuildById[guildId]
    if (fn === 'pull' && rank !== 'journeyman') {
        return `Only the ${name} journeyman pulls.`
    }
    if (fn === 'push' && rank !== 'master') {
        return `Only the ${name} master pushes.`
    }
    return undefined
}
