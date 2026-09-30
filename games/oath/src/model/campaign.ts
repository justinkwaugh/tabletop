import * as Type from 'typebox'
import { Banner } from './oathEnums.js'
import { WarbandOwner } from './warbandCounts.js'

export type WarbandLocation = Type.Static<typeof WarbandLocation>
export const WarbandLocation = Type.Union([
    Type.Object({ kind: Type.Literal('site'), siteId: Type.String() }),
    Type.Object({ kind: Type.Literal('board'), playerId: Type.String() })
])

/** R-5.5.5, R-10.22 — one place and owner the attacker's losses may come from, in the order named. */
export type LossSource = Type.Static<typeof LossSource>
export const LossSource = Type.Object({ at: WarbandLocation, owner: WarbandOwner })

/** R-10.13 — a killed warband returns to its owner's bank. */
export type WarbandGroup = Type.Static<typeof WarbandGroup>
export const WarbandGroup = Type.Object({
    at: WarbandLocation,
    owner: WarbandOwner,
    count: Type.Integer({ minimum: 0, maximum: 999 })
})

/** R-5.5.2 */
export enum CampaignTargetKind {
    Site = 'site',
    Relic = 'relic',
    Banner = 'banner',
    PawnAndFavor = 'pawnAndFavor',
    /** Relic Hunter — a facedown relic at a targeted site. */
    SiteRelic = 'siteRelic'
}

export type CampaignTarget = Type.Static<typeof CampaignTarget>
export const CampaignTarget = Type.Union([
    Type.Object({
        kind: Type.Literal(CampaignTargetKind.Site),
        siteId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(CampaignTargetKind.Relic),
        /** R-5.4.3 — a held relic is faceup, so this is a card id and not a slot. */
        cardId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(CampaignTargetKind.Banner),
        banner: Type.Enum(Banner)
    }),
    Type.Object({ kind: Type.Literal(CampaignTargetKind.PawnAndFavor) }),
    Type.Object({ kind: Type.Literal(CampaignTargetKind.SiteRelic), slotId: Type.String() })
])

/** R-5.5.5 */
export type RolledAttackFace = Type.Static<typeof RolledAttackFace>
export const RolledAttackFace = Type.Object({
    swords: Type.Number(),
    hollowSwords: Type.Number(),
    skulls: Type.Number()
})

/** R-5.5.4 */
export type RolledDefenseFace = Type.Static<typeof RolledDefenseFace>
export const RolledDefenseFace = Type.Object({
    shields: Type.Number(),
    doubling: Type.Boolean()
})

/** R-5.5.4, R-5.5.5 */
export type RollRules = Type.Static<typeof RollRules>
export const RollRules = Type.Object({
    /** Lancers — the attacker's swords count twice. */
    doubleAttackRoll: Type.Optional(Type.Boolean()),
    /** Mounted Patrol — the attacker rolls half their pool, rounded down. */
    halveAttackPool: Type.Optional(Type.Boolean()),
    /** Rusting Ray — the attacker's hollow swords count for nothing. */
    ignoreHollowSwords: Type.Optional(Type.Boolean()),
    /** Rain Boots — the defender's single-shield faces count for nothing. */
    ignoreSingleShields: Type.Optional(Type.Boolean()),
    /** War Tortoise, used by the attacker — the defender's double-shield faces count for nothing. */
    ignoreTwoShieldFaces: Type.Optional(Type.Boolean()),
    /** War Tortoise, used by the defender — the two swords on the skull face count for nothing. */
    ignoreTwoSwordFaces: Type.Optional(Type.Boolean()),
    /** Zealots — each sacrificed warband adds three: the defending force was the larger when it was used. */
    zealots: Type.Optional(Type.Boolean())
})

/** Hospital — a player's warbands that would be killed go to this site instead. */
export type KillRedirect = Type.Static<typeof KillRedirect>
export const KillRedirect = Type.Object({ playerId: Type.String(), siteId: Type.String() })

/** Hospital — warbands saved from a kill, placed on its site when the Campaign ends. */
export type HeldForHospital = Type.Static<typeof HeldForHospital>
export const HeldForHospital = Type.Object({
    playerId: Type.String(),
    siteId: Type.String(),
    owner: WarbandOwner,
    count: Type.Integer({ minimum: 1 })
})

/** R-5.5 */
export type CampaignState = Type.Static<typeof CampaignState>
export const CampaignState = Type.Object({
    attackerPlayerId: Type.String(),
    /** R-5.5.1, R-10.3 — absent when attacking the bandits. */
    defenderPlayerId: Type.Optional(Type.String()),

    /** R-5.5.1.a — Imperial status suspended for this Campaign only. */
    nonImperialPlayerIds: Type.Array(Type.String()),

    /** R-5.5.2.a */
    allyPlayerIds: Type.Array(Type.String()),

    targets: Type.Array(CampaignTarget),

    /** R-5.5.2, R-5.5.3 — the pools as rolled, after any battle plans. */
    attackPool: Type.Number(),
    defensePool: Type.Number(),

    attackRoll: Type.Array(RolledAttackFace),
    defenseRoll: Type.Array(RolledDefenseFace),

    /** R-5.5.4 */
    defense: Type.Number(),
    /** R-5.5.5 — before any sacrifice is added. */
    swords: Type.Number(),

    /** R-10.9 — fixed at the roll; R-5.5.6 kills half of it after the board has changed. */
    defendingForce: Type.Array(WarbandGroup),
    /** R-2.8.3, R-10.3 — not warbands and never killed. */
    defendingBandits: Type.Number(),

    /** R-5.5.5.b */
    attackerVictorious: Type.Optional(Type.Boolean()),
    /** R-5.5.6.a */
    pendingDefeatKills: Type.Optional(Type.Object({ chooserPlayerId: Type.String() })),

    /** R-5.5.3, R-7.5.2 — nothing is rolled while this is present. */
    pendingDefenderPlans: Type.Optional(
        Type.Object({
            skullLossOrder: Type.Optional(Type.Array(LossSource, { maxItems: 16 })),
            /** R-5.5.3.a — the defender first, then each ally with a plan to use. */
            queue: Type.Array(Type.String(), { maxItems: 8 })
        })
    ),
    /** R-5.5.3 — every plan used this Campaign, attacker's first. */
    plansUsed: Type.Array(Type.String(), { maxItems: 16 }),
    /** Outriders — R-5.5.5's skulls killed nothing. */
    ignoreSkulls: Type.Optional(Type.Boolean()),
    /** Wild Allies, Captains, Vow of Union — sites whose warbands of the attacker's join their force. */
    forceSiteIds: Type.Array(Type.String(), { maxItems: 8 }),
    attackerSiteId: Type.Optional(Type.String()),
    /** Hearts and Minds, Peace Envoy — "you're victorious now": nothing is rolled. */
    decidedVictor: Type.Optional(Type.Union([Type.Literal('attacker'), Type.Literal('defender')])),
    /** Jinx — the skulls' kills, held until the reroll question is answered. */
    pendingSkullKills: Type.Optional(
        Type.Object({ skulls: Type.Number(), order: Type.Array(LossSource, { maxItems: 16 }) })
    ),
    /** R-5.5.6 — how many the defeated side killed (Cursed Cauldron). */
    defeatKilled: Type.Optional(Type.Number()),
    /** Peace Envoy — "ignore killing warbands": R-5.5.6 kills nothing. */
    ignoreDefeatKills: Type.Optional(Type.Boolean()),
    killRedirects: Type.Array(KillRedirect, { maxItems: 8 }),
    heldForHospital: Type.Optional(Type.Array(HeldForHospital, { maxItems: 32 })),
    /** R-5.5.8 — "at end, discard" plans. */
    discardAtEnd: Type.Array(Type.String(), { maxItems: 16 }),
    /** R-5.5.6, R-5.5.8 — `bandits` for the compelled ones. */
    plansUsedBy: Type.Record(Type.String(), Type.Array(Type.String(), { maxItems: 16 })),
    rollRules: RollRules,
    /** R-5.5.5 — what one sacrificed warband adds to the attack; Zealots makes it three. */
    sacrificeWorth: Type.Number(),
    /** Specialist, Code of Honor — the defending side may use no (more) battle plans. */
    defenderPlansLocked: Type.Optional(Type.Boolean()),
    /** Martial Culture — the attacker's Act Phase ends once the Campaign is resolved. */
    endsActPhaseAfter: Type.Optional(Type.Boolean())
})

export function campaignTargetKey(target: CampaignTarget): string {
    switch (target.kind) {
        case CampaignTargetKind.Site:
            return `site:${target.siteId}`
        case CampaignTargetKind.Relic:
            return `relic:${target.cardId}`
        case CampaignTargetKind.Banner:
            return `banner:${target.banner}`
        case CampaignTargetKind.PawnAndFavor:
            return 'pawnAndFavor'
        case CampaignTargetKind.SiteRelic:
            return `siteRelic:${target.slotId}`
    }
}
