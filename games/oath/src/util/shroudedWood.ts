import { HydratedOathGameState } from '../model/gameState.js'
import {
    PowerQuestionKind,
    type ShroudedWoodPick,
    type ShroudedWoodPower
} from '../model/question.js'
import type { WarbandOwner } from '../model/warbandCounts.js'
import { ActionType } from '../definition/actions.js'
import { cardPowers } from '../data/cardPowers.js'
import { choiceSpecsFor, type EffectContext } from '../powers/registry.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import { pawnSiteId } from './pawn.js'
import { afterTravelPersistent, reasonPersistentForbidsTravel } from './persistent.js'
import { shroudedWoodChooser, siteTravelTerms } from './siteTravel.js'
import {
    carriedModifiers,
    foldSupplyCost,
    modifierContext,
    reasonModifierDoesNotApply,
    resolveModifiers,
    runAfter,
    type ActiveModifier,
    type ModifierUse
} from './modifiers.js'
import { modifierPayment, reasonCannotPayInAll } from './actionPayment.js'
import { usableFavor } from './favor.js'
import { flipSiteFromVault, type SiteFlip } from './hiddenInputs.js'
import { powerMoveToll } from './powerMoveTolls.js'
import { askQuestion } from './questions.js'

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

/**
 * R-11.7-H2 — a Travel out of an enemy's Shrouded Wood declares its optional cards at its start
 * (Law 7.4, 7.4.1) and pays them then (7.1.2), before the ruler names the site (R-X.4: from
 * revision 15; before it, nothing is declared there).
 */
export function woodTravelTakesCards(state: HydratedOathGameState): boolean {
    return isAtLeastOathRevision(state, OathRevision.EngineFixes11)
}

/** R-11.7 — the traveller's own Travel, as the ruler's question carries it (`ShroudedWoodTravel`). */
export interface WoodTravel {
    free: boolean
    modifiers?: readonly ModifierUse[]
}

export interface WoodPick {
    siteId: string
    cost: number
    /** The Wood's own price to leave, before any modifier. */
    base: number
    /** The cards that changed `base` for this site: a declared one that counts here (Tents, Forest Paths), or Decadent. */
    foldedBy: string[]
}

/**
 * R-11.7-H2 — the declared cards as the Travel takes them: everything that does not depend on the
 * destination is checked, and the costs must be payable together. A card whose choice names
 * something at the destination (Hospitality's bank) is refused: the site is not picked yet.
 */
export function resolveWoodDeclaration(
    state: HydratedOathGameState,
    travelerId: string,
    uses: readonly ModifierUse[] | undefined
): { reason?: string; active: ActiveModifier[] } {
    for (const use of uses ?? []) {
        const power = cardPowers(use.cardId)[use.powerIndex]
        if (power && choiceSpecsFor(power).length > 0) {
            return {
                reason: `${use.cardId}: what it chooses depends on the site, which the Shrouded Wood's ruler has not picked yet`,
                active: []
            }
        }
    }
    const resolved = resolveModifiers(
        state,
        travelerId,
        ActionType.Travel,
        uses,
        {},
        {
            destinationUnknown: true
        }
    )
    if (resolved.reason) return resolved
    const unaffordable = reasonCannotPayInAll(state, travelerId, [modifierPayment(resolved.active)])
    return unaffordable ? { reason: unaffordable, active: [] } : resolved
}

// R-7.6.2 — a "spend no Supply" card sets the price, ignoring any increase; otherwise the folds that changed it.
function priceSetters(
    state: HydratedOathGameState,
    travelerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']>
): string[] {
    const spendsNone = active.filter(
        (m) =>
            m.hooks.spendsNoSupply?.({ ...modifierContext(state, travelerId, m), particulars }) ===
            true
    )
    const setters =
        spendsNone.length > 0 ? spendsNone : active.filter((m) => m.hooks.supplyCost !== undefined)
    return setters.map((m) => m.power.cardId)
}

/**
 * R-7.4.1, R-11.7-H2 — the mandatory modifiers fold for the site picked, and so does each declared
 * card whose condition that site meets (Tents' Q&A: "If the ruler makes you travel to another
 * region, Tents does not work"; Forest Paths' Q&A: a Beast site the enemy ruler picks costs no Supply).
 */
function planWoodPick(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    travel: WoodTravel
): { pick: WoodPick; active: ActiveModifier[] } {
    const here = pawnSiteId(state, travelerId)
    const base = siteTravelTerms(state, here, here, 0, false).cost
    const particulars = { destinationSiteId: siteId }
    const declared = carriedModifiers(state, travel.modifiers).filter(
        (m) => reasonModifierDoesNotApply(state, travelerId, m, particulars) === undefined
    )
    const mandatory = resolveModifiers(state, travelerId, ActionType.Travel, [], particulars).active
    const active = [...declared, ...mandatory]
    const cost = travel.free ? 0 : foldSupplyCost(base, state, travelerId, active, particulars)
    const foldedBy =
        travel.free || cost === base ? [] : priceSetters(state, travelerId, active, particulars)
    return { pick: { siteId, cost, base, foldedBy }, active }
}

/** R-11.7 — what the traveller pays when the ruler picks `siteId`: the Wood's 2, folded for that site. */
export function woodPick(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    travel: WoodTravel
): WoodPick {
    return planWoodPick(state, travelerId, siteId, travel).pick
}

/**
 * R-11.7, Toll Roads — the sites whose toll the traveller can pay: the toll is asked at the pick,
 * before any Supply, so a site they have no favor for is never picked. `committedFavor`: what the
 * declared cards will place, when judged before the Travel pays them (R-11.7-H2).
 */
export function tollPayableWoodSites(
    state: HydratedOathGameState,
    travelerId: string,
    committedFavor = 0
): string[] {
    const favor = usableFavor(state, travelerId) - committedFavor
    return shroudedWoodDestinations(state, travelerId, pawnSiteId(state, travelerId)).filter(
        (siteId) => powerMoveToll(state, travelerId, siteId) === undefined || favor >= 1
    )
}

/** R-11.7 — the sites the ruler may pick: those the traveller may be sent to and can pay for. */
export function payableWoodPicks(
    state: HydratedOathGameState,
    travelerId: string,
    travel: WoodTravel,
    committedFavor = 0
): WoodPick[] {
    const supply = state.getPlayerState(travelerId).supply
    return tollPayableWoodSites(state, travelerId, committedFavor)
        .map((siteId) => woodPick(state, travelerId, siteId, travel))
        .filter((pick) => pick.cost <= supply)
}

export function reasonWoodPickRefused(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    travel: WoodTravel
): string | undefined {
    const here = pawnSiteId(state, travelerId)
    if (!shroudedWoodDestinations(state, travelerId, here).includes(siteId)) {
        return `${siteId} is not a site ${travelerId} can be sent to`
    }
    if (!tollPayableWoodSites(state, travelerId).includes(siteId)) {
        return `${travelerId} has no favor for the toll to travel to ${siteId}`
    }
    const { cost } = woodPick(state, travelerId, siteId, travel)
    const supply = state.getPlayerState(travelerId).supply
    return supply < cost
        ? `${travelerId} cannot pay the ${cost} Supply to travel to ${siteId}: they have ${supply}`
        : undefined
}

/**
 * R-11.7-H2 — the ruler may keep the traveller in place only when they can pay for no site without
 * the cards they declared (Forest Paths' Q&A: "If you have less than 2 Supply, the enemy could either
 * force your Travel action to fail, or could let you travel to a Beast site for free"). The Travel is
 * spent and the cards' costs stay paid.
 */
export function reasonWoodStayRefused(
    state: HydratedOathGameState,
    travelerId: string,
    travel: WoodTravel | undefined
): string | undefined {
    if (!travel || (travel.modifiers?.length ?? 0) === 0) {
        return `the ruler names where ${travelerId} goes`
    }
    return payableWoodPicks(state, travelerId, { free: travel.free }).length > 0
        ? `${travelerId} can pay for a site without the cards they declared, so the ruler names one`
        : undefined
}

function soleWarbandOwner(owners: readonly WarbandOwner[]): WarbandOwner | undefined {
    const distinct = new Set(owners)
    return distinct.size === 1 ? owners[0] : undefined
}

/**
 * R-11.7, R-5.6.2 — the traveller pays and arrives, a facedown site is revealed, then the Travel's
 * after-travel modifiers fire (Tyrant, a declared Dragonskin Drum) and the sites' after-travel
 * powers (Grasping Vines, Boiling Lake). `endsActPhase`: a declared Special Envoy's "After
 * traveling, end your Act Phase" (R-11.7-H2).
 */
export function settleWoodPick(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    travel: WoodTravel
): { pick: ShroudedWoodPick; revealed?: SiteFlip; endsActPhase: boolean } {
    const fromSiteId = pawnSiteId(state, travelerId)
    const { pick, active } = planWoodPick(state, travelerId, siteId, travel)
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
        revealed,
        endsActPhase: after.endsActPhase && woodTravelTakesCards(state)
    }
}

/**
 * R-11.7-H1 — who picks where the Whistle or the Brass Horse sends a pawn out of a Shrouded Wood
 * an enemy rules: that ruler, "even if another player is making you travel". Undefined when no
 * enemy rules the pawn's Wood, and in a game created before revision 15 (R-X.4), where the power
 * moves the pawn itself.
 */
export function woodChooserForPower(
    state: HydratedOathGameState,
    travelerId: string
): string | undefined {
    return isAtLeastOathRevision(state, OathRevision.EngineFixes11)
        ? shroudedWoodChooser(state, travelerId)
        : undefined
}

/** R-11.7-H1 — the ruler is asked in the power's place; the pick moves the pawn (and any toll follows it). */
export function askWoodPickForPower(
    state: HydratedOathGameState,
    askingPlayerId: string,
    chooserId: string,
    travelerId: string,
    power: ShroudedWoodPower
): void {
    const fromSiteId = pawnSiteId(state, travelerId)
    askQuestion(state, askingPlayerId, {
        kind: PowerQuestionKind.ShroudedWoodDestination,
        cardId: state.siteCardAt(fromSiteId) ?? fromSiteId,
        askedPlayerId: chooserId,
        travelerPlayerId: travelerId,
        fromSiteId,
        power
    })
}
