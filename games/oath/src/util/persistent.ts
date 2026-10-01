import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { BattlePlanSide, type CardPower, type PowerCost } from '../data/cardPowers.js'
import type { CampaignParties } from './campaign.js'
import { areEnemies, rulersOfSite, rulesSite } from './rule.js'
import { persistentsOfCard, relicPersistentsHeldBy } from './heldPersistents.js'
import type { PersistentHooks } from '../powers/registry.js'

// R-5.5.1.a — the suspension belongs to the Campaign's parties, not to this lookup.

export interface PersistentContext {
    state: HydratedOathGameState
    cardId: string
    power: CardPower
    /** R-6.6.3 — empty when the bandits rule the site. */
    ownerIds: readonly string[]
    siteId?: string
}

export interface PersistentInPlay {
    ctx: PersistentContext
    hooks: PersistentHooks
}

export { areEnemies }

/** R-10.7 — a site card no player rules is the bandits', and the bandits are enemies to all players. */
function banditsRule(ctx: PersistentContext): boolean {
    return ctx.siteId !== undefined && ctx.ownerIds.length === 0
}

export function enemyOfOwners(ctx: PersistentContext, playerId: string): boolean {
    if (banditsRule(ctx)) return true
    return ctx.ownerIds.some((owner) => areEnemies(ctx.state, owner, playerId))
}

/** Secret Police, Grasping Vines — "a site ruled by its ruler"; the bandits rule every site no player does. */
export function ownersRuleSite(ctx: PersistentContext, siteId: string): boolean {
    if (banditsRule(ctx)) return rulersOfSite(ctx.state, siteId).length === 0
    return ctx.ownerIds.some((owner) => rulesSite(ctx.state, owner, siteId))
}

export function persistentsInPlay(state: HydratedOathGameState): PersistentInPlay[] {
    const found: PersistentInPlay[] = []
    for (const player of state.players) {
        for (const cardId of player.faceupAdviserIds()) {
            found.push(...persistentsOfCard(state, cardId, [player.playerId]))
        }
        found.push(...relicPersistentsHeldBy(state, player))
    }
    for (const [siteId, cards] of Object.entries(state.denizensBySite)) {
        if (!state.isSiteFaceup(siteId)) continue
        const rulers = rulersOfSite(state, siteId)
        for (const cardId of cards) found.push(...persistentsOfCard(state, cardId, rulers, siteId))
    }
    return found
}

export function firstPersistentReason(
    state: HydratedOathGameState,
    ask: (hooks: PersistentHooks, ctx: PersistentContext) => string | undefined
): string | undefined {
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        const reason = ask(hooks, ctx)
        if (reason) return reason
    }
    return undefined
}

export function runPersistent(
    state: HydratedOathGameState,
    run: (hooks: PersistentHooks, ctx: PersistentContext) => string | undefined
): string[] {
    const notes: string[] = []
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        const note = run(hooks, ctx)
        if (note) notes.push(note)
    }
    return notes
}

export function sumPersistent(
    state: HydratedOathGameState,
    read: (hooks: PersistentHooks, ctx: PersistentContext) => number | undefined
): number {
    let total = 0
    for (const { ctx, hooks } of persistentsInPlay(state)) total += read(hooks, ctx) ?? 0
    return total
}

export function reasonPersistentForbidsTrade(
    state: HydratedOathGameState,
    actorId: string,
    cardId: string
) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsTrade?.(ctx, actorId, cardId))
}
export function reasonPersistentForbidsMuster(
    state: HydratedOathGameState,
    actorId: string,
    cardId: string
) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsMuster?.(ctx, actorId, cardId))
}
export function reasonPersistentForbidsFacedownAdviser(
    state: HydratedOathGameState,
    actorId: string
) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsFacedownAdviser?.(ctx, actorId))
}
export function reasonPersistentForbidsFaceupVision(
    state: HydratedOathGameState,
    actorId: string,
    cardId: string
) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsFaceupVision?.(ctx, actorId, cardId))
}
export function reasonPersistentForbidsBannerTake(
    state: HydratedOathGameState,
    actorId: string,
    banner: Banner,
    holderId?: string
) {
    return firstPersistentReason(state, (h, ctx) =>
        h.forbidsBannerTake?.(ctx, actorId, banner, holderId)
    )
}
export function reasonPersistentForbidsRelicTake(
    state: HydratedOathGameState,
    actorId: string,
    holderId: string,
    relicCardId: string
) {
    return firstPersistentReason(state, (h, ctx) =>
        h.forbidsRelicTake?.(ctx, actorId, holderId, relicCardId)
    )
}
export function reasonPersistentForbidsSecretCost(state: HydratedOathGameState, actorId: string) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsSecretCosts?.(ctx, actorId))
}
export function reasonPersistentForbidsGivingSecrets(
    state: HydratedOathGameState,
    actorId: string
) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsGivingSecrets?.(ctx, actorId))
}
export function reasonPersistentForbidsCampaign(state: HydratedOathGameState, actorId: string) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsCampaign?.(ctx, actorId))
}
export function reasonPersistentForbidsSacrifice(
    state: HydratedOathGameState,
    attackerId: string,
    defenderId: string | undefined
) {
    return firstPersistentReason(state, (h, ctx) =>
        h.forbidsSacrifice?.(ctx, attackerId, defenderId)
    )
}
export function reasonPersistentForbidsExile(state: HydratedOathGameState, citizenId: string) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsExile?.(ctx, citizenId))
}
export function reasonPersistentForbidsBattlePlan(
    state: HydratedOathGameState,
    userId: string,
    power: CardPower,
    parties: CampaignParties,
    side: BattlePlanSide
) {
    return firstPersistentReason(state, (h, ctx) =>
        h.forbidsBattlePlan?.(ctx, userId, power, parties, side)
    )
}
export function reasonPersistentForbidsTargets(
    state: HydratedOathGameState,
    parties: CampaignParties,
    defensePool: number
) {
    return firstPersistentReason(state, (h, ctx) => h.forbidsTargets?.(ctx, parties, defensePool))
}

/** Gleaming Armor, Insect Swarm */
export function extraBattlePlanCost(
    state: HydratedOathGameState,
    userId: string,
    parties: CampaignParties,
    side: BattlePlanSide
): PowerCost {
    const total: PowerCost = { placeFavor: 0, burnFavor: 0, placeSecret: 0, burnSecret: 0 }
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        const extra = hooks.battlePlanExtraCost?.(ctx, userId, parties, side)
        if (!extra) continue
        total.placeFavor += extra.placeFavor ?? 0
        total.burnFavor += extra.burnFavor ?? 0
        total.placeSecret += extra.placeSecret ?? 0
        total.burnSecret += extra.burnSecret ?? 0
    }
    return total
}

export function persistentRelicDefenseBonus(
    state: HydratedOathGameState,
    holderId: string
): number {
    return sumPersistent(state, (h, ctx) => h.relicDefenseBonus?.(ctx, holderId))
}
export function persistentPawnDefenseBonus(state: HydratedOathGameState, holderId: string): number {
    return sumPersistent(state, (hooks, ctx) => hooks.pawnDefenseBonus?.(ctx, holderId))
}
export function persistentMatchingAdvisers(
    state: HydratedOathGameState,
    holderId: string,
    suit: Suit
): number {
    return sumPersistent(state, (h, ctx) => h.extraMatchingAdvisers?.(ctx, holderId, suit))
}

export function afterTravelPersistent(
    state: HydratedOathGameState,
    actorId: string,
    from: string | undefined,
    to: string
): string[] {
    return runPersistent(state, (h, ctx) => h.afterTravel?.(ctx, actorId, from, to))
}
export function afterTitleTakenPersistent(
    state: HydratedOathGameState,
    newHolderId: string
): string[] {
    return runPersistent(state, (h, ctx) => h.afterTitleTaken?.(ctx, newHolderId))
}
export function afterCardPlayedPersistent(
    state: HydratedOathGameState,
    actorId: string,
    cardId: string
): string[] {
    return runPersistent(state, (h, ctx) => h.afterCardPlayed?.(ctx, actorId, cardId))
}
export function reasonPersistentForbidsTravel(
    state: HydratedOathGameState,
    actorId: string,
    fromSiteId: string | undefined,
    toSiteId: string
) {
    return firstPersistentReason(state, (hooks, ctx) =>
        hooks.forbidsTravel?.(ctx, actorId, fromSiteId, toSiteId)
    )
}
/** Vow of Union */
export function persistentForceSites(state: HydratedOathGameState, attackerId: string): string[] {
    const sites = new Set<string>()
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        for (const siteId of hooks.extraForceSites?.(ctx, attackerId) ?? []) sites.add(siteId)
    }
    return [...sites]
}
export function afterRelicsTakenPersistent(
    state: HydratedOathGameState,
    takerId: string,
    relicCardIds: readonly string[]
): string[] {
    if (relicCardIds.length === 0) return []
    return runPersistent(state, (hooks, ctx) =>
        hooks.afterRelicsTaken?.(ctx, takerId, relicCardIds)
    )
}
export function afterCampaignPersistent(
    state: HydratedOathGameState,
    attackerId: string,
    defenderId: string | undefined
): string[] {
    return runPersistent(state, (hooks, ctx) => hooks.afterCampaign?.(ctx, attackerId, defenderId))
}
export function afterBannerRecoveredPersistent(
    state: HydratedOathGameState,
    actorId: string,
    banner: Banner,
    paid: number
): string[] {
    return runPersistent(state, (h, ctx) => h.afterBannerRecovered?.(ctx, actorId, banner, paid))
}
