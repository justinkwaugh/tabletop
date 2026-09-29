import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    Color,
    GameAction,
    HydratableAction,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PlayerStatus } from '../model/oathEnums.js'
import {
    CampaignTarget,
    type CampaignState,
    CampaignTargetKind,
    LossSource
} from '../model/campaign.js'
import type { CampaignDeclaration } from '../model/pendingCampaign.js'
import { ConsentRequestKind } from '../model/consent.js'
import { BattlePlanUse, BattlePlanUses } from '../model/battlePlanUse.js'
import { turnOrderFrom } from '../util/questions.js'
import {
    applyDiceDelta,
    collectDefensePool,
    reasonCannotChooseDefender,
    reasonCannotDeclareTargets,
    reasonNoCampaignAgainst,
    scopeOf,
    suspendedImperialsFor,
    type CampaignParties
} from '../util/campaign.js'
import { attackDiceFromSites } from '../util/sitePowers.js'
import { isImperialPlayer, rulingColorsOf, warbandsAt } from '../util/rule.js'
import { holdTurnForSneakAttack, sneakAttackOfferedTo } from '../util/sneakAttack.js'
import { reasonPersistentForbidsCampaign, persistentForceSites } from '../util/persistent.js'
import { warbandsOnBoardOf } from '../util/force.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import {
    applyBattlePlans,
    banditBattlePlans,
    BANDITS_PLAN_USER,
    resolveBattlePlans,
    usableBattlePlans,
    defendingPlayerIds,
    plansTargetSiteRelics
} from '../util/battlePlans.js'
import { reasonLossOrderOutsideForce, rollCampaign } from '../util/campaignRoll.js'
import { attackingSiteOf, sitesWithTargets, targetedSiteIds } from '../util/campaignSite.js'
import { pawnSiteId } from '../util/pawn.js'
import { flipSecretFacedown, reasonSitesForbidTargets } from '../util/siteTravel.js'
import { countOf } from '../util/warbands.js'
import { campaignAsIfSiteNow } from '../util/freeActions.js'

export function forceSitesOf(state: HydratedOathGameState, playerId: string): string[] {
    const asIfSiteId = campaignAsIfSiteNow(state, playerId)
    const sites = new Set<string>(asIfSiteId ? [asIfSiteId] : [])
    for (const siteId of persistentForceSites(state, playerId)) sites.add(siteId)
    return [...sites]
}

/** R-5.5.3, R-7.5.1 — the attacker's plans against the sides as they stand; Relic Hunter must be among them to target a facedown relic. */
export function reasonAttackerPlansInvalid(
    state: HydratedOathGameState,
    playerId: string,
    parties: CampaignParties,
    targets: readonly CampaignTarget[],
    plans: readonly BattlePlanUse[] | undefined
): string | undefined {
    const resolved = resolveBattlePlans(state, playerId, BattlePlanSide.Attacker, plans, parties)
    if (resolved.reason) return resolved.reason
    if (
        targets.some((t) => t.kind === CampaignTargetKind.SiteRelic) &&
        !resolved.active.some((p) => p.hooks.targetsSiteRelics)
    ) {
        return 'a facedown relic at a site can be targeted only with Relic Hunter declared'
    }
    return undefined
}

/** R-5.5.1 */
export const CAMPAIGN_SUPPLY_COST = 2

/** R-5.5.1 */
export type CampaignDefender = Type.Static<typeof CampaignDefender>
export const CampaignDefender = Type.Union([
    Type.Object({ kind: Type.Literal('player'), playerId: Type.String() }),
    /** R-5.5.1 — available only when no player rules your site. */
    Type.Object({ kind: Type.Literal('bandits') })
])

/** R-5.5.3 to R-5.5.5 — the battle as mustered and, unless the defending side still has plans to use, rolled. */
export type CampaignBattleMetadata = Type.Static<typeof CampaignBattleMetadata>
export const CampaignBattleMetadata = Type.Object({
    attackPool: Type.Number(),
    defensePool: Type.Number(),
    /** R-5.5.4 */
    defense: Type.Number(),
    /** R-5.5.5 — before any sacrifice. */
    swords: Type.Number(),
    /** R-5.5.5 — before the sacrifice decision. */
    skullsKilled: Type.Number(),
    /** R-5.5.3 — the bandits' compelled plans included. */
    plansUsed: Type.Optional(Type.Array(Type.String())),
    /** R-11.4 */
    siteDice: Type.Optional(
        Type.Array(Type.Object({ siteId: Type.String(), attack: Type.Number() }))
    ),
    planNotes: Type.Optional(Type.Array(Type.String())),
    awaitingDefender: Type.Optional(Type.Boolean())
})

export type CampaignMetadata = Type.Static<typeof CampaignMetadata>
export const CampaignMetadata = Type.Object({
    supplySpent: Type.Number(),
    /** R-5.5.2.a — Citizens are asked whether to join the defence before anything is mustered. */
    awaitingAllies: Type.Optional(Type.Boolean()),
    battle: Type.Optional(CampaignBattleMetadata)
})

export type Campaign = Type.Static<typeof Campaign>
export const Campaign = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Campaign),
            playerId: Type.String(),
            defender: CampaignDefender,
            /** R-5.5.2 */
            targets: Type.Array(CampaignTarget, { maxItems: 64 }),
            /** R-11.13 — to target The Hidden Place. */
            flipSecret: Type.Optional(Type.Boolean()),
            /** R-5.5.2 — up to the warbands on the attacker's board. */
            attackDice: Type.Integer({ minimum: 0, maximum: 999 }),
            /** R-5.5.3 — used once each. */
            plans: BattlePlanUses,
            /** R-5.5.5 — where the skulls' kills come from first; the rest follow the default. */
            skullLossOrder: Type.Optional(Type.Array(LossSource, { maxItems: 16 })),
            metadata: Type.Optional(CampaignMetadata)
        })
    ])
)

export const CampaignValidator = Compile(Campaign)

export function isCampaign(action?: GameAction): action is Campaign {
    return action?.type === ActionType.Campaign
}

export class HydratedCampaign extends HydratableAction<typeof Campaign> implements Campaign {
    declare type: ActionType.Campaign
    declare playerId: string
    declare defender: CampaignDefender
    declare targets: CampaignTarget[]
    declare flipSecret?: boolean
    declare attackDice: number
    declare plans?: BattlePlanUse[]
    declare skullLossOrder?: LossSource[]
    declare metadata?: CampaignMetadata

    constructor(data: Campaign) {
        super(data, CampaignValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedCampaign.reasonCannotCampaign(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot campaign: ${reason}`)
        }

        const attacker = state.getPlayerState(this.playerId)
        const parties = HydratedCampaign.partiesFor(state, this.playerId, this)
        const toAsk = HydratedCampaign.optionalAllies(state, parties)
        // R-11.13
        if (this.flipSecret) flipSecretFacedown(state, this.playerId)

        // R-5.5.1 — or nothing, right after a Knights Errant Muster / Hunting
        // Party Search, or as a Sneak Attack.
        const supplyCost = HydratedCampaign.supplyCostFor(state, this.playerId)
        if (sneakAttackOfferedTo(state, this.playerId)) holdTurnForSneakAttack(state, this.playerId)
        attacker.spendSupply(supplyCost)
        delete attacker.freeCampaignAtAction
        // Wild Allies, Captains — acting from elsewhere, with the warbands there
        // in the force; Vow of Union — the warbands at every site you rule.
        const asIfSiteId = campaignAsIfSiteNow(state, this.playerId)
        const forceSiteIds = forceSitesOf(state, this.playerId)
        delete attacker.campaignAsIf

        const declaration: CampaignDeclaration = {
            attackerPlayerId: this.playerId,
            defenderPlayerId: parties.defenderPlayerId,
            targets: this.targets,
            attackDice: this.attackDice,
            plans: this.plans,
            skullLossOrder: this.skullLossOrder,
            attackerSiteId: asIfSiteId ?? attacker.siteId,
            forceSiteIds,
            allyPlayerIds: [...parties.allyPlayerIds]
        }

        // R-X.3 — the PRNG moves now, or at the roll this has committed to.
        this.revealsInfo = true

        if (toAsk.length > 0) {
            state.pendingCampaign = { declaration, toAsk }
            HydratedCampaign.askToJoinDefence(state)
            this.metadata = { supplySpent: supplyCost, awaitingAllies: true }
            return
        }

        this.metadata = {
            supplySpent: supplyCost,
            battle: HydratedCampaign.muster(state, declaration)
        }
    }

    /** R-5.5.2.a — the sides as declared, with the Citizens who joined. */
    static partiesOfDeclaration(
        state: HydratedOathGameState,
        declaration: CampaignDeclaration
    ): CampaignParties {
        return {
            attackerPlayerId: declaration.attackerPlayerId,
            defenderPlayerId: declaration.defenderPlayerId,
            allyPlayerIds: declaration.allyPlayerIds,
            nonImperialPlayerIds: suspendedImperialsFor(
                state,
                declaration.attackerPlayerId,
                declaration.defenderPlayerId
            ),
            targets: declaration.targets
        }
    }

    /** R-5.5.3 to R-5.5.5 */
    static muster(
        state: HydratedOathGameState,
        declaration: CampaignDeclaration
    ): CampaignBattleMetadata {
        const attackerPlayerId = declaration.attackerPlayerId
        const parties = HydratedCampaign.partiesOfDeclaration(state, declaration)

        let pools = {
            attackPool: declaration.attackDice,
            defensePool: collectDefensePool(state, parties)
        }

        // R-5.5.3, R-5.5.3-H1 — the attacker's plans first, then the bandits' compelled ones.
        const resolved = resolveBattlePlans(
            state,
            attackerPlayerId,
            BattlePlanSide.Attacker,
            declaration.plans,
            parties
        )
        assert(
            resolved.reason === undefined,
            `the declared battle plans were checked against every possible ally: ${resolved.reason}`
        )
        const attackerPlans = applyBattlePlans(state, attackerPlayerId, resolved.active, pools, {
            parties,
            side: BattlePlanSide.Attacker
        })
        pools = attackerPlans.pools
        // Specialist — "your enemy cannot use battle plans", the bandits included.
        const bandits =
            declaration.defenderPlayerId === undefined && !attackerPlans.locksEnemyPlans
                ? applyBattlePlans(state, undefined, banditBattlePlans(state), pools, {
                      parties,
                      side: BattlePlanSide.Defender
                  })
                : undefined
        if (bandits) pools = bandits.pools

        const siteDice = attackDiceFromSites(state, sitesWithTargets(state, parties))
        for (const delta of siteDice) {
            pools = applyDiceDelta(pools, { attack: delta.attack })
        }

        const plansUsed = [...attackerPlans.used, ...(bandits?.used ?? [])]
        const discardAtEnd = [...attackerPlans.discardAtEnd, ...(bandits?.discardAtEnd ?? [])]
        const rollRules = { ...attackerPlans.rollRules, ...(bandits?.rollRules ?? {}) }

        const campaign: CampaignState = {
            attackerPlayerId,
            defenderPlayerId: parties.defenderPlayerId,
            nonImperialPlayerIds: [...parties.nonImperialPlayerIds],
            allyPlayerIds: [...parties.allyPlayerIds],
            targets: declaration.targets,
            attackPool: pools.attackPool,
            defensePool: pools.defensePool,
            attackRoll: [],
            defenseRoll: [],
            defense: 0,
            swords: 0,
            defendingForce: [],
            defendingBandits: 0,
            plansUsed,
            ignoreSkulls: attackerPlans.ignoreSkulls || undefined,
            discardAtEnd,
            plansUsedBy: {
                ...(attackerPlans.used.length > 0
                    ? { [attackerPlayerId]: attackerPlans.used }
                    : {}),
                ...(bandits && bandits.used.length > 0 ? { [BANDITS_PLAN_USER]: bandits.used } : {})
            },
            rollRules,
            sacrificeWorth: 1,
            // Specialist — "the defender cannot use battle plans" (the whole
            // defending side, per its entry: R-10.28-H1).
            defenderPlansLocked: attackerPlans.locksEnemyPlans || undefined,
            forceSiteIds: declaration.forceSiteIds,
            attackerSiteId: declaration.attackerSiteId,
            decidedVictor: attackerPlans.decidesVictor ? 'attacker' : undefined,
            ignoreDefeatKills:
                attackerPlans.ignoreDefeatKills || bandits?.ignoreDefeatKills || undefined,
            killRedirects: attackerPlans.killRedirects
        }
        state.campaign = campaign

        const answering = campaign.defenderPlansLocked
            ? []
            : defendingPlayerIds(parties).filter(
                  (id) => usableBattlePlans(state, id, BattlePlanSide.Defender).length > 0
              )
        const awaitingDefender = answering.length > 0

        let skullsKilled = 0
        if (awaitingDefender) {
            campaign.pendingDefenderPlans = {
                skullLossOrder: declaration.skullLossOrder,
                queue: answering
            }
        } else {
            skullsKilled = rollCampaign(state, campaign, declaration.skullLossOrder)
        }

        return {
            attackPool: pools.attackPool,
            defensePool: pools.defensePool,
            defense: campaign.defense,
            swords: campaign.swords,
            skullsKilled,
            plansUsed: campaign.plansUsed.length > 0 ? campaign.plansUsed : undefined,
            siteDice: siteDice.length > 0 ? siteDice : undefined,
            planNotes: attackerPlans.notes.length > 0 ? attackerPlans.notes : undefined,
            awaitingDefender: awaitingDefender || undefined
        }
    }

    /** R-5.5.1.a, R-5.5.2.a — before any Citizen joins. */
    static partiesFor(
        state: HydratedOathGameState,
        playerId: string,
        choice: { defender: CampaignDefender; targets: CampaignTarget[] }
    ): CampaignParties {
        const defenderPlayerId =
            choice.defender.kind === 'player' ? choice.defender.playerId : undefined
        const nonImperialPlayerIds = suspendedImperialsFor(state, playerId, defenderPlayerId)
        const base: CampaignParties = {
            attackerPlayerId: playerId,
            defenderPlayerId,
            allyPlayerIds: [],
            nonImperialPlayerIds,
            targets: choice.targets
        }
        return { ...base, allyPlayerIds: HydratedCampaign.compulsoryAllies(state, base) }
    }

    static reasonCannotCampaign(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            defender: CampaignDefender
            targets: CampaignTarget[]
            attackDice: number
            plans?: readonly BattlePlanUse[]
            flipSecret?: boolean
            skullLossOrder?: readonly LossSource[]
        }
    ): string | undefined {
        if (state.campaign || state.pendingCampaign) {
            // R-4.2 — finish one action before starting the next.
            return 'a Campaign is already under way'
        }

        const attacker = state.getPlayerState(playerId)
        // R-7.1.4 — Vow of Peace: "you cannot campaign".
        const sworn = reasonPersistentForbidsCampaign(state, playerId)
        if (sworn) return sworn
        const supplyCost = HydratedCampaign.supplyCostFor(state, playerId)
        if (attacker.supply < supplyCost) {
            return `costs ${supplyCost} Supply, player has ${attacker.supply}`
        }

        const defenderReason = HydratedCampaign.reasonCannotChooseDefender(
            state,
            playerId,
            choice.defender
        )
        if (defenderReason) return defenderReason

        if (choice.attackDice < 0) {
            return 'must declare at least 0 attack dice'
        }
        const board =
            warbandsOnBoardOf(state, playerId) + HydratedCampaign.siteForceOf(state, playerId)
        if (choice.attackDice > board) {
            return `can add at most ${board} attack dice, one per warband in your force`
        }
        const lossOrderReason = reasonLossOrderOutsideForce(
            state,
            playerId,
            forceSitesOf(state, playerId),
            choice.skullLossOrder
        )
        if (lossOrderReason) return lossOrderReason

        const parties = HydratedCampaign.partiesFor(state, playerId, choice)

        const targetReason = reasonCannotDeclareTargets(state, parties)
        if (targetReason) return targetReason
        // R-11.8, R-11.13 — the Narrow Pass's must and The Hidden Place's cannot.
        const barred = reasonSitesForbidTargets(state, parties, choice.flipSecret === true)
        if (barred) return barred

        // R-5.5.2 then R-5.5.3 — with Citizens to ask, the attacker's plans wait for their answers.
        if (HydratedCampaign.optionalAllies(state, parties).length > 0) {
            if ((choice.plans?.length ?? 0) > 0) {
                return 'battle plans are declared once the Citizens asked to join have answered'
            }
            // Relic Hunter — its target is declared now and the plan once they have answered.
            const hunter = plansTargetSiteRelics(
                usableBattlePlans(state, playerId, BattlePlanSide.Attacker)
            )
            return choice.targets.some((t) => t.kind === CampaignTargetKind.SiteRelic) && !hunter
                ? 'a facedown relic at a site can be targeted only with Relic Hunter to declare'
                : undefined
        }
        return reasonAttackerPlansInvalid(state, playerId, parties, choice.targets, choice.plans)
    }

    /** R-5.5.1, R-5.5.2 */
    static legalDefenders(state: HydratedOathGameState, playerId: string): CampaignDefender[] {
        const defenders: CampaignDefender[] = [
            ...state.players
                .filter((other) => other.playerId !== playerId)
                .map((other) => ({ kind: 'player' as const, playerId: other.playerId })),
            { kind: 'bandits' }
        ]
        return defenders.filter(
            (defender) =>
                HydratedCampaign.reasonCannotChooseDefender(state, playerId, defender) ===
                    undefined &&
                reasonNoCampaignAgainst(
                    state,
                    playerId,
                    defender.kind === 'player' ? defender.playerId : undefined
                ) === undefined
        )
    }

    static canDoCampaign(state: HydratedOathGameState, playerId: string): boolean {
        if (state.campaign || state.pendingCampaign) return false
        if (reasonPersistentForbidsCampaign(state, playerId)) return false
        const attacker = state.getPlayerState(playerId)
        if (attacker.supply < HydratedCampaign.supplyCostFor(state, playerId)) return false
        return HydratedCampaign.legalDefenders(state, playerId).length > 0
    }

    static supplyCostFor(state: HydratedOathGameState, playerId: string): number {
        if (sneakAttackOfferedTo(state, playerId)) return 0
        const player = state.getPlayerState(playerId)
        return player.freeCampaignAtAction === state.actionCount ? 0 : CAMPAIGN_SUPPLY_COST
    }

    private static siteForceOf(state: HydratedOathGameState, playerId: string): number {
        const colors = rulingColorsOf(state, playerId)
        return forceSitesOf(state, playerId).reduce((total, siteId) => {
            const onSite = warbandsAt(state, siteId)
            return total + colors.reduce((n, color) => n + countOf(onSite, color), 0)
        }, 0)
    }

    /** R-5.5.2.a — "the Chancellor joins as an Ally" when an Imperial player defends. */
    private static compulsoryAllies(
        state: HydratedOathGameState,
        parties: CampaignParties
    ): string[] {
        const defenderId = parties.defenderPlayerId
        if (!defenderId || !isImperialPlayer(state, defenderId, scopeOf(parties))) return []
        const chancellorId = state.chancellorId()
        return chancellorId !== defenderId && chancellorId !== parties.attackerPlayerId
            ? [chancellorId]
            : []
    }

    /** R-5.5.2.a, R-10.2-H1 — clockwise from the attacker. */
    static optionalAllies(state: HydratedOathGameState, parties: CampaignParties): string[] {
        const defenderId = parties.defenderPlayerId
        if (!defenderId || !isImperialPlayer(state, defenderId, scopeOf(parties))) return []
        const sites = targetedSiteIds(parties)
        const attackerSiteId = attackingSiteOf(state, parties.attackerPlayerId)
        return turnOrderFrom(state, parties.attackerPlayerId).filter((playerId) => {
            if (playerId === parties.attackerPlayerId || playerId === defenderId) return false
            if (parties.allyPlayerIds.includes(playerId)) return false
            if (state.getPlayerState(playerId).status !== PlayerStatus.Citizen) return false
            const siteId = pawnSiteId(state, playerId)
            return siteId === attackerSiteId || sites.includes(siteId)
        })
    }

    /** R-5.5.2.a */
    static askToJoinDefence(state: HydratedOathGameState): void {
        const pending = state.pendingCampaign
        assertExists(pending, 'Citizens are asked only while a Campaign is held for them')
        state.pendingConsent = {
            request: { kind: ConsentRequestKind.JoinDefence, citizenPlayerId: pending.toAsk[0] },
            askingPlayerId: pending.declaration.attackerPlayerId,
            askedPlayerId: pending.toAsk[0]
        }
    }

    /** R-5.5.1, and Sneak Attack's "if you declare them as the defender". */
    private static reasonCannotChooseDefender(
        state: HydratedOathGameState,
        attackerId: string,
        defender: CampaignDefender
    ): string | undefined {
        const defenderPlayerId = defender.kind === 'player' ? defender.playerId : undefined
        const offer = sneakAttackOfferedTo(state, attackerId)
        if (offer && defenderPlayerId !== offer.defenderPlayerId) {
            return `a Sneak Attack must declare ${offer.defenderPlayerId} as the defender`
        }
        return reasonCannotChooseDefender(state, attackerId, defenderPlayerId)
    }
}
