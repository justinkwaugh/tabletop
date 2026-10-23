import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { reasonPersistentForbidsTravel } from './persistent.js'
import { reasonTollsUnpaid, tollsFor, travelFreeByToll, wayStationRuled } from './tolls.js'
import {
    reasonFlipInvalid,
    reasonSitesForbidTravel,
    secretsFlipped,
    shroudedWoodChooser,
    siteTravelTerms,
    type TravelFlip
} from './siteTravel.js'
import { baseTravelCost } from './travelCost.js'
import {
    foldSupplyCost,
    resolveModifiers,
    usableModifiers,
    type ActionPlan,
    type ModifierUse
} from './modifiers.js'
import {
    isFreeTravelNow,
    payableWoodPicks,
    resolveWoodDeclaration,
    tollPayableWoodSites,
    woodPick,
    woodChooserForTravel,
    woodTravelPaysAtPick,
    woodTravelTakesCards
} from './shroudedWood.js'
import { usableFavor } from './favor.js'
import { pawnSiteId, regionOfPawn } from './pawn.js'
import {
    modifierPayment,
    reasonCannotPayInAll,
    secretPayment,
    tollPayment
} from './actionPayment.js'

/**
 * The optional payments a Travel carries: the tolls paid and the secrets flipped for the Buried
 * Giant and The Hidden Place, as the action records them (`TravelFlip`).
 */
export type TravelTerms = { tolls: string[]; flipSecret: TravelFlip }

/** R-11.7 — before `UiBatch1`: 2 Supply to leave, or none on a free Travel. */
export function shroudedWoodTravelCost(state: HydratedOathGameState, playerId: string): number {
    return isFreeTravelNow(state, playerId)
        ? 0
        : siteTravelTerms(state, pawnSiteId(state, playerId), pawnSiteId(state, playerId), 0, 0)
              .cost
}

/**
 * R-11.7 — leaving an enemy's Shrouded Wood names no destination, and the ruler must have a site the
 * traveller can pay for. R-11.7-H2 (revision 15): the optional cards are declared and paid at the
 * start, and counted for each pick; no toll or flip is declared, as the destination is unknown and
 * the Wood ignores The Hidden Place and the Narrow Pass. Before revision 15 nothing is declared.
 */
export function reasonCannotLeaveShroudedWood(
    state: HydratedOathGameState,
    playerId: string,
    choice: {
        siteId?: string
        modifiers?: readonly ModifierUse[]
        tolls?: readonly string[]
        flipSecret?: TravelFlip
    }
): string | undefined {
    const chooser = shroudedWoodChooser(state, playerId)
    if (chooser === undefined) {
        return 'no enemy rules the Shrouded Wood you stand at'
    }
    // R-11.7-H4 — Portal from its own site ignores the Wood: a normal Travel, with its site named.
    if (woodChooserForTravel(state, playerId, choice.modifiers) === undefined) {
        return 'Portal ignores the Shrouded Wood: name the site you travel to'
    }
    if (choice.siteId !== undefined) return "the Shrouded Wood's ruler chooses where you go"
    const cardsDeclared = (choice.modifiers?.length ?? 0) > 0
    if (
        (cardsDeclared && !woodTravelTakesCards(state)) ||
        (choice.tolls?.length ?? 0) > 0 ||
        choice.flipSecret
    ) {
        return woodTravelTakesCards(state)
            ? "no toll or flip is declared on a Travel whose destination the Shrouded Wood's ruler chooses"
            : "nothing is declared on a Travel whose destination the Shrouded Wood's ruler chooses"
    }
    const supply = state.getPlayerState(playerId).supply
    if (!woodTravelPaysAtPick(state)) {
        const cost = shroudedWoodTravelCost(state, playerId)
        return supply < cost ? `costs ${cost} Supply, player has ${supply}` : undefined
    }
    const declared = resolveWoodDeclaration(state, playerId, choice.modifiers)
    if (declared.reason) return declared.reason
    // R-7.1.2 — the cards' costs are paid before the ruler picks, so their favor is not there for a toll.
    const committed = modifierPayment(declared.active).favor
    const travel = {
        free: isFreeTravelNow(state, playerId),
        ...(cardsDeclared ? { modifiers: choice.modifiers } : {})
    }
    if (payableWoodPicks(state, playerId, travel, committed).length > 0) return undefined
    const sites = tollPayableWoodSites(state, playerId, committed)
    if (sites.length === 0) {
        const favor = usableFavor(state, playerId) - committed
        return `${chooser} would pick where you go, and every site takes a favor for its toll: you have ${favor}`
    }
    const cheapest = Math.min(
        ...sites.map((siteId) => woodPick(state, playerId, siteId, travel).cost)
    )
    return `${chooser} would pick where you go, and you can pay for no site: the cheapest is ${cheapest} Supply, you have ${supply}`
}

export function travelPlan(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    modifiers?: readonly ModifierUse[],
    tolls?: readonly string[],
    flipSecret: TravelFlip = false
): ActionPlan & { siteNotes: string[] } {
    const player = state.getPlayerState(playerId)
    const flips = secretsFlipped(flipSecret)
    if (woodChooserForTravel(state, playerId, modifiers) !== undefined) {
        return {
            reason: "the Shrouded Wood's ruler chooses where you go",
            cost: 0,
            active: [],
            siteNotes: []
        }
    }
    const base = travelCostFor(state, playerId, siteId)
    if (base === undefined) {
        return {
            reason: `${siteId} is not a site on the map`,
            cost: 0,
            active: [],
            siteNotes: []
        }
    }
    const here = pawnSiteId(state, playerId)
    if (here === siteId) {
        return {
            reason: 'your pawn already occupies that site',
            cost: base,
            active: [],
            siteNotes: []
        }
    }
    // R-7.1.4 — Vow of Union's "cannot travel from a site you rule".
    const sworn = reasonPersistentForbidsTravel(state, playerId, here, siteId)
    if (sworn) return { reason: sworn, cost: base, active: [], siteNotes: [] }
    const resolved = resolveModifiers(state, playerId, ActionType.Travel, modifiers, {
        destinationSiteId: siteId
    })
    if (resolved.reason) return { reason: resolved.reason, cost: base, active: [], siteNotes: [] }
    // Forest Paths, Portal — "ignore the powers of sites", which then ask no secret either.
    const sitesIgnored = resolved.active.some((m) => m.hooks.ignoresSitePowers === true)
    // R-11.8, R-11.13 — the Narrow Pass's must and The Hidden Place's cannot.
    const barred = sitesIgnored
        ? reasonFlipInvalid(state, playerId, 0, flips)
        : reasonSitesForbidTravel(state, playerId, here, siteId, flips)
    if (barred) return { reason: barred, cost: base, active: [], siteNotes: [] }
    // R-11.3, R-11.6, R-11.7, R-11.12 — the sites' own prices.
    const siteTerms = sitesIgnored
        ? { cost: base, spendsNoSupply: false, notes: [] }
        : siteTravelTerms(state, here, siteId, base, flips)
    let cost = foldSupplyCost(
        siteTerms.cost,
        state,
        playerId,
        resolved.active,
        { destinationSiteId: siteId },
        siteTerms.spendsNoSupply
    )
    // R-7.1.4 — Toll Roads' demand, Way Station's offer (`util/tolls.ts`).
    const unpaid = reasonTollsUnpaid(state, playerId, { kind: 'travel', toSiteId: siteId }, tolls)
    if (unpaid) return { reason: unpaid, cost, active: resolved.active, siteNotes: siteTerms.notes }
    const unaffordable = reasonCannotPayInAll(state, playerId, [
        modifierPayment(resolved.active),
        tollPayment(tolls),
        secretPayment(flips)
    ])
    if (unaffordable)
        return {
            reason: unaffordable,
            cost,
            active: resolved.active,
            siteNotes: siteTerms.notes
        }
    if (
        travelFreeByToll(state, playerId, siteId, tolls) ||
        wayStationRuled(state, playerId, siteId)
    )
        cost = 0
    // Second Wind — "you may travel … spending no Supply" as the very next action.
    if (player.freeTravelAtAction === state.actionCount) cost = 0
    if (player.supply < cost) {
        return {
            reason: `costs ${cost} Supply, player has ${player.supply}`,
            cost,
            active: resolved.active,
            siteNotes: siteTerms.notes
        }
    }
    return { cost, active: resolved.active, siteNotes: siteTerms.notes }
}

export function reasonCannotTravel(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    modifiers?: readonly ModifierUse[],
    tolls?: readonly string[],
    flipSecret: TravelFlip = false
): string | undefined {
    return travelPlan(state, playerId, siteId, modifiers, tolls, flipSecret).reason
}

export function travelCostFor(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string
): number | undefined {
    if (!state.allSiteIds().includes(siteId)) return undefined
    return baseTravelCost(regionOfPawn(state, playerId), state.regionOf(siteId))
}

/**
 * R-7.1.4, R-11.12, R-11.13-H2, R-X.1 — every legal pairing of the player's optional travel
 * payments: Way Station's favor instead of Supply, and the secrets flipped (none, one, or from
 * the Buried Giant to The Hidden Place two). Demanded tolls are in every pairing.
 */
export function legalTravelTerms(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    modifiers?: readonly ModifierUse[]
): TravelTerms[] {
    const available = tollsFor(state, playerId, { kind: 'travel', toSiteId: siteId })
    const demanded = available.filter((t) => !t.discount).map((t) => t.cardId)
    const tollSets = [
        demanded,
        ...available.filter((t) => t.discount).map((t) => [...demanded, t.cardId])
    ]
    return tollSets
        .flatMap((tolls) => TRAVEL_FLIPS.map((flipSecret): TravelTerms => ({ tolls, flipSecret })))
        .filter(
            (terms) =>
                travelPlan(state, playerId, siteId, modifiers, terms.tolls, terms.flipSecret)
                    .reason === undefined
        )
}

const TRAVEL_FLIPS: readonly TravelFlip[] = [false, true, 2]

/** R-5.6.1 */
export function legalTravelDestinations(
    state: HydratedOathGameState,
    playerId: string,
    modifiers?: readonly ModifierUse[]
): string[] {
    return state
        .allSiteIds()
        .filter((siteId) => legalTravelTerms(state, playerId, siteId, modifiers).length > 0)
}

/**
 * R-11.7-H2 — the declarations a Travel out of an enemy's Wood may make, as far as opening it goes:
 * none, or each usable card alone. A pick one card makes payable needs no other card (one "spend no
 * Supply" sets the price to 0), and a second card only places more favor, so no larger set opens a
 * Travel that these do not.
 */
function woodDeclarationsToTry(state: HydratedOathGameState, playerId: string): ModifierUse[][] {
    if (!woodTravelTakesCards(state)) return [[]]
    const cards = usableModifiers(state, playerId, ActionType.Travel).map((power) => [
        { cardId: power.cardId, powerIndex: power.powerIndex }
    ])
    return [[], ...cards]
}

export function canTravel(state: HydratedOathGameState, playerId: string): boolean {
    if (shroudedWoodChooser(state, playerId) !== undefined) {
        // R-11.7-H4 — a declaration with Portal from its own site is a normal Travel.
        return woodDeclarationsToTry(state, playerId).some((modifiers) =>
            woodChooserForTravel(state, playerId, modifiers) === undefined
                ? legalTravelDestinations(state, playerId, modifiers).length > 0
                : reasonCannotLeaveShroudedWood(state, playerId, { modifiers }) === undefined
        )
    }
    return legalTravelDestinations(state, playerId).length > 0
}
