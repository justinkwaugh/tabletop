import { HydratedOathGameState } from '../model/gameState.js'
import type { ShroudedWoodPick } from '../model/question.js'
import type { WarbandOwner } from '../model/warbandCounts.js'
import { ActionType } from '../definition/actions.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import { pawnSiteId } from './pawn.js'
import { afterTravelPersistent, reasonPersistentForbidsTravel } from './persistent.js'
import { siteTravelTerms } from './siteTravel.js'
import { foldSupplyCost, resolveModifiers, runAfter, type ActiveModifier } from './modifiers.js'
import { flipSiteFromVault, type SiteFlip } from './hiddenInputs.js'

/** R-11.7 — from a Shrouded Wood the Narrow Pass and The Hidden Place are ignored; any other site the traveler may go to. */
export function shroudedWoodDestinations(
    state: HydratedOathGameState,
    travelerId: string,
    fromSiteId: string
): string[] {
    return state
        .allSiteIds()
        .filter(
            (siteId) =>
                siteId !== fromSiteId &&
                reasonPersistentForbidsTravel(state, travelerId, fromSiteId, siteId) === undefined
        )
}

/** R-11.7, R-X.4 — a Travel out of an enemy's Shrouded Wood pays when its ruler names the site. */
export function woodTravelPaysAtPick(state: HydratedOathGameState): boolean {
    return isAtLeastOathRevision(state, OathRevision.UiBatch1)
}

/** Second Wind, Brass Horse — this Travel spends no Supply. */
export function isFreeTravelNow(state: HydratedOathGameState, playerId: string): boolean {
    return state.getPlayerState(playerId).freeTravelAtAction === state.actionCount
}

export interface WoodPick {
    siteId: string
    cost: number
    /** The Wood's own price to leave, before any modifier. */
    base: number
    /** The modifiers that changed `base` for this site (Decadent). */
    foldedBy: string[]
}

// R-7.4.1 — no modifier is declared on this Travel; the mandatory ones fold for the site picked.
function planWoodPick(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    free: boolean
): { pick: WoodPick; active: ActiveModifier[] } {
    const here = pawnSiteId(state, travelerId)
    const base = siteTravelTerms(state, here, here, 0, false).cost
    const particulars = { destinationSiteId: siteId }
    const { active } = resolveModifiers(state, travelerId, ActionType.Travel, [], particulars)
    const cost = free ? 0 : foldSupplyCost(base, state, travelerId, active, particulars)
    const foldedBy =
        free || cost === base
            ? []
            : active.filter((m) => m.hooks.supplyCost !== undefined).map((m) => m.power.cardId)
    return { pick: { siteId, cost, base, foldedBy }, active }
}

/** R-11.7 — what the traveller pays when the ruler picks `siteId`: the Wood's 2, folded for that site. */
export function woodPick(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    free: boolean
): WoodPick {
    return planWoodPick(state, travelerId, siteId, free).pick
}

/** R-11.7 — the sites the ruler may pick: those the traveller may be sent to and can pay for. */
export function payableWoodPicks(
    state: HydratedOathGameState,
    travelerId: string,
    free: boolean
): WoodPick[] {
    const supply = state.getPlayerState(travelerId).supply
    return shroudedWoodDestinations(state, travelerId, pawnSiteId(state, travelerId))
        .map((siteId) => woodPick(state, travelerId, siteId, free))
        .filter((pick) => pick.cost <= supply)
}

export function reasonWoodPickRefused(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    free: boolean
): string | undefined {
    const here = pawnSiteId(state, travelerId)
    if (!shroudedWoodDestinations(state, travelerId, here).includes(siteId)) {
        return `${siteId} is not a site ${travelerId} can be sent to`
    }
    const { cost } = woodPick(state, travelerId, siteId, free)
    const supply = state.getPlayerState(travelerId).supply
    return supply < cost
        ? `${travelerId} cannot pay the ${cost} Supply to travel to ${siteId}: they have ${supply}`
        : undefined
}

function soleWarbandOwner(owners: readonly WarbandOwner[]): WarbandOwner | undefined {
    const distinct = new Set(owners)
    return distinct.size === 1 ? owners[0] : undefined
}

/**
 * R-11.7, R-5.6.2 — the traveller pays and arrives, a facedown site is revealed, then the Travel's
 * after-travel modifiers fire (Tyrant) and the sites' after-travel powers (Grasping Vines, Boiling Lake).
 */
export function settleWoodPick(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    free: boolean
): { pick: ShroudedWoodPick; revealed?: SiteFlip } {
    const fromSiteId = pawnSiteId(state, travelerId)
    const { pick, active } = planWoodPick(state, travelerId, siteId, free)
    const traveler = state.getPlayerState(travelerId)
    traveler.spendSupply(pick.cost)
    traveler.siteId = siteId
    const revealed = state.isSiteFaceup(siteId) ? undefined : flipSiteFromVault(state, siteId)
    const after = runAfter(state, travelerId, active, { destinationSiteId: siteId })
    const notes = [...after.notes, ...afterTravelPersistent(state, travelerId, fromSiteId, siteId)]
    return {
        pick: {
            travelerPlayerId: travelerId,
            siteId,
            supplySpent: pick.cost,
            supplyRemaining: traveler.supply,
            notes: notes.length > 0 ? notes : undefined,
            warbandOwner: soleWarbandOwner(after.warbandOwners)
        },
        revealed
    }
}
