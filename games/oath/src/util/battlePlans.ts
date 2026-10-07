import { assertExists } from '@tabletop/common'
import { usableFavor } from './favor.js'
import { burnedFavorTaker } from './burn.js'
import type { ActionPayment } from './actionPayment.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'
import { HydratedOathGameState } from '../model/gameState.js'
import {
    BattlePlanSide,
    cardPowers,
    isFree,
    PowerTiming,
    powersWithTiming,
    type CardPower,
    type PowerCost,
    powerKey
} from '../data/cardPowers.js'
import { denizensOnMap } from './access.js'
import { isFacedownAdviserOf, rulesCard } from './access.js'
import { banditsRuleSite } from './rule.js'
import {
    addCosts,
    favorNeeded,
    payCostOnCard,
    payPowerCost,
    reasonCannotPayPowerCost,
    secretsNeeded
} from './powerCost.js'
import { PowerChoice, reasonChoicesInvalid } from './powerChoice.js'
import { applyDiceDelta, type CampaignParties, type DicePools } from './campaign.js'
import type { CampaignState, KillRedirect, RollRules } from '../model/campaign.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import {
    effectFor,
    type BattlePlanContext,
    type BattlePlanHooks,
    type CampaignContext,
    type PlayerPlanContext
} from '../powers/registry.js'
import {
    extraBattlePlanCost,
    reasonPersistentForbidsBattlePlan,
    reasonPersistentForbidsSecretCost
} from './persistent.js'

// R-5.5.3, R-7.5.2 — plans are used at Campaign step 3, so the defender sees the attacker's first.

/** Relic Hunter */
export function plansTargetSiteRelics(plans: readonly BattlePlanUse[]): boolean {
    return plans.some((use) => {
        const power = cardPowers(use.cardId)[use.powerIndex]
        return power !== undefined && effectFor(power)?.battlePlan?.targetsSiteRelics === true
    })
}

export interface ActiveBattlePlan {
    power: CardPower
    hooks: BattlePlanHooks
    choices: readonly PowerChoice[]
    compelled: boolean
}

function admits(power: CardPower, side: BattlePlanSide): boolean {
    return power.battlePlanSide === side || power.battlePlanSide === BattlePlanSide.Either
}

export function isBattlePlanCard(state: HydratedOathGameState, cardId: string): boolean {
    return powersWithTiming(cardId, PowerTiming.BattlePlan).length > 0
}

/** R-7.5.1, R-7.1.1-H1 */
export function mayUseBattlePlansOf(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string
): boolean {
    // R-5.1.4.II — a facedown adviser is ruled but has no power.
    if (isFacedownAdviserOf(state, playerId, cardId)) return false
    if (rulesCard(state, playerId, cardId)) return true
    return state.getPlayerState(playerId).relicIds.includes(cardId)
}

export function usableBattlePlans(
    state: HydratedOathGameState,
    playerId: string,
    side: BattlePlanSide
): CardPower[] {
    const player = state.getPlayerState(playerId)
    const candidates = new Set<string>([
        ...player.faceupAdviserIds(),
        ...player.relicIds,
        ...denizensOnMap(state)
    ])
    const found: CardPower[] = []
    for (const cardId of candidates) {
        if (!mayUseBattlePlansOf(state, playerId, cardId)) continue
        for (const power of powersWithTiming(cardId, PowerTiming.BattlePlan)) {
            if (!admits(power, side)) continue
            if (!effectFor(power)?.battlePlan) continue
            if (reasonCannotPayPowerCost(state, playerId, power)) continue
            found.push(power)
        }
    }
    return found
}

export function resolveBattlePlans(
    state: HydratedOathGameState,
    playerId: string,
    side: BattlePlanSide,
    uses: readonly BattlePlanUse[] | undefined,
    parties: CampaignParties,
    /** The Hidden Place's flipped secret, taken before the plans are paid. */
    spentFirst?: ActionPayment
): { reason?: string; active: ActiveBattlePlan[] } {
    const active: ActiveBattlePlan[] = []
    const seen = new Set<string>()
    for (const use of uses ?? []) {
        const key = powerKey(use.cardId, use.powerIndex)
        if (seen.has(key)) {
            return {
                reason: `${use.cardId} power ${use.powerIndex} was used twice (R-5.5.3: once each)`,
                active
            }
        }
        seen.add(key)
        if (!mayUseBattlePlansOf(state, playerId, use.cardId)) {
            return { reason: `you do not rule ${use.cardId} (R-7.5.1)`, active }
        }
        const power = cardPowers(use.cardId)[use.powerIndex]
        if (!power)
            return { reason: `${use.cardId} has no power at index ${use.powerIndex}`, active }
        if (power.timing !== PowerTiming.BattlePlan) {
            return {
                reason: `${use.cardId}'s power ${use.powerIndex} is ${power.timing}, not a battle plan`,
                active
            }
        }
        if (!admits(power, side)) {
            return {
                reason: `${use.cardId} is a ${power.battlePlanSide} plan and you are the ${side} (R-7.5)`,
                active
            }
        }
        const effect = effectFor(power)
        assertExists(
            effect?.battlePlan,
            `${use.cardId} power ${use.powerIndex} registers no battle plan`
        )
        const unpayable = reasonCannotPayPowerCost(state, playerId, power)
        if (unpayable) return { reason: unpayable, active }
        // R-7.1.4 — Marsh Spirit, Beast Tamer, True Names.
        const barred = reasonPersistentForbidsBattlePlan(state, playerId, power, parties, side)
        if (barred) return { reason: barred, active }
        // Gleaming Armor, Insect Swarm
        const total = addCosts(power.cost, extraBattlePlanCost(state, playerId, parties, side))
        const me = state.getPlayerState(playerId)
        const usable = usableFavor(state, playerId)
        if (usable < favorNeeded(total))
            return {
                reason: `${use.cardId} costs ${favorNeeded(total)} favor here, player has ${usable}`,
                active
            }
        if (me.secrets < secretsNeeded(total))
            return {
                reason: `${use.cardId} costs ${secretsNeeded(total)} secrets here, player has ${me.secrets}`,
                active
            }
        // Spell Breaker — its Q&A names Gleaming Armor's added secret.
        if (secretsNeeded(total) > 0) {
            const secretBarred = reasonPersistentForbidsSecretCost(state, playerId)
            if (secretBarred) return { reason: secretBarred, active }
        }
        const badChoice = reasonChoicesInvalid(state, playerId, power, use.choices)
        if (badChoice) return { reason: badChoice, active }
        // The pools are not settled yet, so a cross-check reads them as zero.
        const ctx: PlayerPlanContext = {
            state,
            playerId,
            power,
            choices: use.choices ?? [],
            campaign: { parties, side, pools: { attackPool: 0, defensePool: 0 } }
        }
        const cross = effect.battlePlan.reasonCannotUse?.(ctx)
        if (cross) return { reason: cross, active }
        active.push({
            power,
            hooks: effect.battlePlan,
            choices: use.choices ?? [],
            compelled: false
        })
    }
    // Code of Honor — "you cannot use other battle plans" (R-9.2).
    const exclusive = active.find((p) => p.hooks.exclusive)
    if (exclusive && active.length > 1) {
        return {
            reason: `${exclusive.power.cardId}: you cannot use other battle plans with it`,
            active
        }
    }
    // R-X.4 — a game created before this revision checked each plan alone.
    if (isAtLeastOathRevision(state, OathRevision.PlanCostsAndSearchPlays)) {
        const extra = extraBattlePlanCost(state, playerId, parties, side)
        const short = reasonCannotPayPlansInOrder(state, playerId, active, extra, spentFirst)
        if (short) return { reason: short, active }
    }
    return { active }
}

/**
 * R-7.1.2 — a side's plans are paid one after another from one holding, as `applyBattlePlans`
 * pays them: each printed cost, then the cost an enemy's card adds. A favor burned while the
 * payer holds Vow of Renewal comes straight back to them, so it pays the next plan too.
 */
function reasonCannotPayPlansInOrder(
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveBattlePlan[],
    extra: PowerCost,
    spentFirst: ActionPayment | undefined
): string | undefined {
    const takesBurns = burnedFavorTaker(state) === playerId
    let favorOut = spentFirst?.favor ?? 0
    let favorNeed = favorOut
    let secrets = spentFirst?.secrets ?? 0
    for (const plan of active) {
        for (const cost of [plan.power.cost, extra]) {
            favorNeed = Math.max(favorNeed, favorOut + favorNeeded(cost))
            favorOut += favorNeeded(cost) - (takesBurns ? cost.burnFavor : 0)
            secrets += secretsNeeded(cost)
        }
    }
    const heldFavor = usableFavor(state, playerId)
    if (favorNeed > heldFavor) {
        return `your battle plans cost ${favorNeed} favor in all, you hold ${heldFavor}`
    }
    const heldSecrets = state.getPlayerState(playerId).secrets
    if (secrets > heldSecrets) {
        return `your battle plans cost ${secrets} ${secrets === 1 ? 'secret' : 'secrets'} in all, you hold ${heldSecrets}`
    }
    return undefined
}

/** R-5.5.3-H1 — the bandits' plans come from every site they rule, not only the targeted ones. */
export function banditBattlePlans(state: HydratedOathGameState): ActiveBattlePlan[] {
    const found: ActiveBattlePlan[] = []
    for (const siteId of state.allSiteIds()) {
        if (!banditsRuleSite(state, siteId)) continue
        for (const cardId of state.denizensAt(siteId)) {
            for (const power of powersWithTiming(cardId, PowerTiming.BattlePlan)) {
                if (!admits(power, BattlePlanSide.Defender) || !isFree(power.cost)) continue
                const hooks = effectFor(power)?.battlePlan
                if (!hooks) continue
                found.push({ power, hooks, choices: [], compelled: true })
            }
        }
    }
    // Code of Honor — "you cannot use other battle plans" binds the bandits' own too.
    const exclusive = found.find((plan) => plan.hooks.exclusive)
    return exclusive ? [exclusive] : found
}

export interface BattlePlanOutcome {
    pools: DicePools
    notes: string[]
    /** Outriders, R-5.5.5 */
    ignoreSkulls: boolean
    /** R-5.5.8 — "At end, discard …" */
    discardAtEnd: string[]
    used: string[]
    rollRules: RollRules
    /** Specialist */
    locksEnemyPlans: boolean
    /** Code of Honor — nobody else on this side may use one either (R-10.28-H1). */
    exclusive: boolean
    /** Hearts and Minds, Peace Envoy */
    decidesVictor: boolean
    /** Peace Envoy, R-5.5.6 */
    ignoreDefeatKills: boolean
    /** Hospital */
    killRedirects: KillRedirect[]
}

/** In order, so R-5.5.3's underflow crosses over per plan; `playerId` is undefined for the bandits. */
export function applyBattlePlans(
    state: HydratedOathGameState,
    playerId: string | undefined,
    active: readonly ActiveBattlePlan[],
    pools: DicePools,
    campaign: Omit<CampaignContext, 'pools'>
): BattlePlanOutcome {
    const out: BattlePlanOutcome = {
        pools,
        notes: [],
        ignoreSkulls: false,
        discardAtEnd: [],
        used: [],
        rollRules: {},
        locksEnemyPlans: false,
        exclusive: false,
        decidesVictor: false,
        ignoreDefeatKills: false,
        killRedirects: []
    }
    for (const plan of active) {
        const ctx: BattlePlanContext = {
            state,
            playerId,
            power: plan.power,
            choices: plan.choices,
            campaign: { ...campaign, pools: out.pools }
        }
        if (!plan.compelled && playerId !== undefined) {
            payPowerCost(state, playerId, plan.power)
            payCostOnCard(
                state,
                playerId,
                plan.power.cardId,
                extraBattlePlanCost(state, playerId, campaign.parties, campaign.side)
            )
        }
        const delta = plan.hooks.dice?.(ctx)
        if (delta) out.pools = applyDiceDelta(out.pools, delta)
        const note = plan.hooks.onUse?.(ctx)
        if (note) out.notes.push(note)
        // "Ignore all skulls you roll" — only the attacking side rolls skulls, so a defender's does nothing.
        if (plan.hooks.ignoreSkulls && campaign.side === BattlePlanSide.Attacker) {
            out.ignoreSkulls = true
        }
        const discards =
            typeof plan.hooks.discardAtEnd === 'function'
                ? plan.hooks.discardAtEnd(ctx)
                : plan.hooks.discardAtEnd
        if (discards) out.discardAtEnd.push(plan.power.cardId)
        const rules =
            typeof plan.hooks.rollRules === 'function'
                ? plan.hooks.rollRules(ctx)
                : plan.hooks.rollRules
        if (rules) out.rollRules = { ...out.rollRules, ...rules }
        if (plan.hooks.locksEnemyPlans) out.locksEnemyPlans = true
        if (plan.hooks.exclusive) out.exclusive = true
        if (plan.hooks.decidesVictor) out.decidesVictor = true
        if (plan.hooks.ignoreKills) {
            out.ignoreSkulls = true
            out.ignoreDefeatKills = true
        }
        const redirect = plan.hooks.redirectKillsTo?.(ctx)
        if (redirect && playerId !== undefined)
            out.killRedirects.push({ playerId, siteId: redirect })
        out.used.push(plan.power.cardId)
    }
    return out
}

export const BANDITS_PLAN_USER = 'bandits'

export function sideOf(campaign: { attackerPlayerId: string }, playerId: string): BattlePlanSide {
    return playerId === campaign.attackerPlayerId
        ? BattlePlanSide.Attacker
        : BattlePlanSide.Defender
}

/** R-5.5.2.a */
export function defendingPlayerIds(
    parties: Pick<CampaignParties, 'defenderPlayerId' | 'allyPlayerIds'>
): string[] {
    return [parties.defenderPlayerId, ...parties.allyPlayerIds].filter(
        (id): id is string => id !== undefined
    )
}

export function partySideOf(
    parties: CampaignParties,
    playerId: string
): BattlePlanSide | undefined {
    const inParty =
        playerId === parties.attackerPlayerId || defendingPlayerIds(parties).includes(playerId)
    return inParty ? sideOf(parties, playerId) : undefined
}

/** R-10.29 — "your enemy"; the bandits have none. */
export function opposingLeadId(
    parties: Pick<CampaignParties, 'attackerPlayerId' | 'defenderPlayerId'>,
    side: BattlePlanSide
): string | undefined {
    return side === BattlePlanSide.Attacker ? parties.defenderPlayerId : parties.attackerPlayerId
}

/** R-5.5.6 */
export function plansUsedBy(
    state: HydratedOathGameState,
    campaign: CampaignState,
    playerId: string
): ActiveBattlePlan[] {
    const ids = campaign.plansUsedBy[playerId] ?? []
    const found: ActiveBattlePlan[] = []
    for (const cardId of ids) {
        for (const power of powersWithTiming(cardId, PowerTiming.BattlePlan)) {
            const hooks = effectFor(power)?.battlePlan
            if (hooks) found.push({ power, hooks, choices: [], compelled: false })
        }
    }
    return found
}

/** R-5.5.2.a — the attacker alone, or the defender and their allies. */
export function playerIdsOnSide(campaign: CampaignState, side: BattlePlanSide): string[] {
    return side === BattlePlanSide.Attacker
        ? [campaign.attackerPlayerId]
        : defendingPlayerIds(campaign)
}

/** Billowing Fog, Traveling Doctor — "ignore powers that kill all of your force" (R-9.2). */
export function ignoresKillAll(
    state: HydratedOathGameState,
    campaign: CampaignState,
    side: BattlePlanSide
): boolean {
    return (
        isAtLeastOathRevision(state, OathRevision.EngineFixes2) &&
        playerIdsOnSide(campaign, side)
            .flatMap((id) => plansUsedBy(state, campaign, id))
            .some((plan) => plan.hooks.defeatKills === 'none')
    )
}
