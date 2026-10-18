import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { BattlePlanSide, type CardPower, type PowerCost } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import type { CampaignParties } from './campaign.js'
import { areEnemies, rulersOfSite, rulesSite, type ImperialScope } from './rule.js'
import { persistentsOfCard, relicPersistentsHeldBy } from './heldPersistents.js'
import type { PersistentHooks } from '../powers/registry.js'
import type { BannerTake } from './seize.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/** R-5.5.1.a — the Campaign's suspensions, as a caller holds them before the Campaign is open. */
export type ScopedParties = Pick<CampaignParties, 'nonImperialPlayerIds'>

/**
 * R-5.5.1.a-H2 — from a Campaign's declaration to its end, who rules a site or the cards there, and
 * who is whose enemy, are judged in its scope: the parties a caller holds, else the open Campaign's.
 * R-X.4: before revision 14 persistent and site powers ignored it.
 */
export function powerScopeOf(
    state: HydratedOathGameState,
    parties?: ScopedParties
): ImperialScope | undefined {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes10)) return undefined
    const sides = parties ?? state.campaign
    return sides ? { nonImperialPlayerIds: sides.nonImperialPlayerIds } : undefined
}

export interface PersistentContext {
    state: HydratedOathGameState
    cardId: string
    power: CardPower
    /** R-6.6.3 — empty when the bandits rule the site; judged in `scope`. */
    ownerIds: readonly string[]
    siteId?: string
    /** R-5.5.1.a-H2 — the Campaign's scope, for every rule and enemy test the power makes. */
    scope?: ImperialScope
}

export interface PersistentInPlay {
    ctx: PersistentContext
    hooks: PersistentHooks
}

export { areEnemies }

/**
 * R-10.7 — a site card no player rules is the bandits', and the bandits are enemies to all players.
 * The scope empties no site's rulers: a site's warbands are ruled by their owner, the Chancellor for
 * the Empire's, in any scope, and the Bandit Crown's bandits serve its holder at a site without them.
 */
function banditsRule(ctx: PersistentContext): boolean {
    return ctx.siteId !== undefined && ctx.ownerIds.length === 0
}

export function enemyOfOwners(ctx: PersistentContext, playerId: string): boolean {
    if (banditsRule(ctx)) return true
    return ctx.ownerIds.some((owner) => areEnemies(ctx.state, owner, playerId, ctx.scope))
}

/** Secret Police, Grasping Vines — "a site ruled by its ruler"; the bandits rule every site no player does. */
export function ownersRuleSite(ctx: PersistentContext, siteId: string): boolean {
    if (banditsRule(ctx)) return rulersOfSite(ctx.state, siteId, ctx.scope).length === 0
    return ctx.ownerIds.some((owner) => rulesSite(ctx.state, owner, siteId, ctx.scope))
}

/** `parties`: the Campaign's, from a caller that holds them before the Campaign is open. */
export function persistentsInPlay(
    state: HydratedOathGameState,
    parties?: ScopedParties
): PersistentInPlay[] {
    const scope = powerScopeOf(state, parties)
    const found: PersistentInPlay[] = []
    for (const player of state.players) {
        for (const cardId of player.faceupAdviserIds()) {
            found.push(...persistentsOfCard(state, cardId, [player.playerId], { scope }))
        }
        found.push(...relicPersistentsHeldBy(state, player, scope))
    }
    for (const [siteId, cards] of Object.entries(state.denizensBySite)) {
        if (!state.isSiteFaceup(siteId)) continue
        const rulers = rulersOfSite(state, siteId, scope)
        for (const cardId of cards) {
            found.push(...persistentsOfCard(state, cardId, rulers, { siteId, scope }))
        }
    }
    return found
}

/** A persistent power's refusal, with the card it is on. */
export interface PersistentRefusal {
    cardId: string
    reason: string
}

export function firstPersistentRefusal(
    state: HydratedOathGameState,
    ask: (hooks: PersistentHooks, ctx: PersistentContext) => string | undefined,
    parties?: ScopedParties
): PersistentRefusal | undefined {
    for (const { ctx, hooks } of persistentsInPlay(state, parties)) {
        const reason = ask(hooks, ctx)
        if (reason) return { cardId: ctx.cardId, reason }
    }
    return undefined
}

export function firstPersistentReason(
    state: HydratedOathGameState,
    ask: (hooks: PersistentHooks, ctx: PersistentContext) => string | undefined,
    parties?: ScopedParties
): string | undefined {
    return firstPersistentRefusal(state, ask, parties)?.reason
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
    read: (hooks: PersistentHooks, ctx: PersistentContext) => number | undefined,
    parties?: ScopedParties
): number {
    let total = 0
    for (const { ctx, hooks } of persistentsInPlay(state, parties)) total += read(hooks, ctx) ?? 0
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
export function persistentRefusesBannerTake(
    state: HydratedOathGameState,
    actorId: string,
    banner: Banner,
    how: BannerTake,
    holderId?: string,
    parties?: ScopedParties
) {
    return firstPersistentRefusal(
        state,
        (h, ctx) => h.forbidsBannerTake?.(ctx, actorId, banner, how, holderId),
        parties
    )
}
export function reasonPersistentForbidsBannerTake(
    state: HydratedOathGameState,
    actorId: string,
    banner: Banner,
    how: BannerTake,
    holderId?: string,
    parties?: ScopedParties
) {
    return persistentRefusesBannerTake(state, actorId, banner, how, holderId, parties)?.reason
}
export function persistentRefusesRelicTake(
    state: HydratedOathGameState,
    actorId: string,
    holderId: string,
    relicCardId: string,
    parties?: ScopedParties
) {
    return firstPersistentRefusal(
        state,
        (h, ctx) => h.forbidsRelicTake?.(ctx, actorId, holderId, relicCardId),
        parties
    )
}
export function reasonPersistentForbidsRelicTake(
    state: HydratedOathGameState,
    actorId: string,
    holderId: string,
    relicCardId: string,
    parties?: ScopedParties
) {
    return persistentRefusesRelicTake(state, actorId, holderId, relicCardId, parties)?.reason
}
export function persistentRefusesSecretCost(
    state: HydratedOathGameState,
    actorId: string,
    parties?: ScopedParties
) {
    return firstPersistentRefusal(state, (h, ctx) => h.forbidsSecretCosts?.(ctx, actorId), parties)
}
export function reasonPersistentForbidsSecretCost(
    state: HydratedOathGameState,
    actorId: string,
    parties?: ScopedParties
) {
    return persistentRefusesSecretCost(state, actorId, parties)?.reason
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
    defendingIds: readonly string[]
) {
    return firstPersistentReason(state, (h, ctx) =>
        h.forbidsSacrifice?.(ctx, attackerId, defendingIds)
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
    return firstPersistentReason(
        state,
        (h, ctx) => h.forbidsBattlePlan?.(ctx, userId, power, parties, side),
        parties
    )
}
export function reasonPersistentForbidsTargets(
    state: HydratedOathGameState,
    parties: CampaignParties,
    targetDice: number
) {
    return firstPersistentReason(
        state,
        (h, ctx) => h.forbidsTargets?.(ctx, parties, targetDice),
        parties
    )
}

/** Gleaming Armor, Insect Swarm */
export function extraBattlePlanCost(
    state: HydratedOathGameState,
    userId: string,
    parties: CampaignParties,
    side: BattlePlanSide
): PowerCost {
    const total: PowerCost = { placeFavor: 0, burnFavor: 0, placeSecret: 0, burnSecret: 0 }
    for (const { ctx, hooks } of persistentsInPlay(state, parties)) {
        const extra = hooks.battlePlanExtraCost?.(ctx, userId, parties, side)
        if (!extra) continue
        total.placeFavor += extra.placeFavor ?? 0
        total.burnFavor += extra.burnFavor ?? 0
        total.placeSecret += extra.placeSecret ?? 0
        total.burnSecret += extra.burnSecret ?? 0
    }
    return total
}

/** Sealing Ward and Circlet of Command are an adviser and a relic: the scope is passed for one rule. */
export function persistentRelicDefenseBonus(
    state: HydratedOathGameState,
    holderId: string,
    parties?: ScopedParties
): number {
    return sumPersistent(state, (h, ctx) => h.relicDefenseBonus?.(ctx, holderId), parties)
}
export function persistentPawnDefenseBonus(
    state: HydratedOathGameState,
    holderId: string,
    parties?: ScopedParties
): number {
    return sumPersistent(state, (hooks, ctx) => hooks.pawnDefenseBonus?.(ctx, holderId), parties)
}
export function persistentMatchingAdvisers(
    state: HydratedOathGameState,
    holderId: string,
    suit: Suit
): number {
    return sumPersistent(state, (h, ctx) => h.extraMatchingAdvisers?.(ctx, holderId, suit))
}

/** R-5.1.4.IV, R-5.3.2 — a player's faceup advisers of a suit, Marriage counting as two hearth advisers. */
export function advisersOfSuit(
    state: HydratedOathGameState,
    holderId: string,
    suit: Suit,
    suitIn: (cardId: string) => Suit | undefined = suitOf
): number {
    const faceup = state
        .getPlayerState(holderId)
        .faceupAdviserIds()
        .filter((cardId) => suitIn(cardId) === suit).length
    return faceup + persistentMatchingAdvisers(state, holderId, suit)
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
    placed: number
): string[] {
    return runPersistent(state, (h, ctx) => h.afterBannerRecovered?.(ctx, actorId, banner, placed))
}
