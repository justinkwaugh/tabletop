import { range } from '@tabletop/common'
import {
    Banner,
    HydratedRecover,
    HydratedSetupChoice,
    HydratedTravel,
    RecoverTargetKind,
    Suit,
    defaultTolls,
    tollsFor,
    usableFavor,
    type HydratedOathGameState,
    type ModifierUse,
    type Toll,
    type TollOccasion,
    type TravelTerms
} from '@tabletop/oath'
import type { TravelChoice } from './travelRows.js'

/**
 * R-1.23.1 — Setup's start sites on the map: lit while the pick is open (`pickable`), the one
 * picked marked; once the discards are asked, or when one site is legal, the pick alone.
 */
export type BoardPick = {
    sites: string[]
    label: string
    picked: string | undefined
    pickable: boolean
}

/** A choice made by tapping the map, as a phone frames it: the sites its frame and chips count. */
export type MapPick = {
    /**
     * Setup's start site, a Travel destination, where the spoils banish the defeated pawn, a site
     * for the powers in Use a power, or the Shrouded Wood ruler's pick for another player's pawn.
     */
    kind: 'start' | 'travel' | 'banish' | 'power' | 'ruler'
    sites: string[]
    /** More than one site to choose among; Setup's one legal site is shown, not chosen. */
    choosing: boolean
    /**
     * Whose pawn the pick moves, so the map opens on its region: the seat's own, the defender's
     * for a banish, the traveller's or the moved player's for the Shrouded Wood ruler's pick.
     */
    moverId: string | undefined
}

/**
 * R-11.7, R-11.13-H1 — a site the open Travel question lets the asked seat pick on the map: what
 * the pawn's owner pays there in Supply (none when nothing is paid at the pick), the cards that
 * set it (Decadent, Tents), whether Toll Roads will ask them (R-7.1.4), and whether the move flips
 * a secret (The Hidden Place).
 */
export type TravelPickSite = {
    siteId: string
    cost: number | undefined
    foldedBy: string[]
    toll: boolean
    /** R-11.13-H1 — the secrets the move flips: The Hidden Place's, and the Buried Giant's past a Narrow Pass. */
    flips: number
}

/**
 * R-11.7, R-11.13-H1 — a Travel question answered on the map: the Shrouded Wood ruler's pick (for
 * the traveller's own Travel, or for a pawn the Whistle, the Brass Horse, Palanquin or a banish
 * moves) or the Brass Horse user's own pick.
 */
export type TravelPick = {
    /** Whose pawn moves. */
    moverId: string
    /** The Shrouded Wood's ruler picks for another player. */
    ruler: boolean
    /** The move spends no Supply: the line says so once, and the sites carry no price. */
    free: boolean
    sites: TravelPickSite[]
}

export type SiteOffer =
    | {
          slotId: string
          intent: 'start'
          label: string
          /** The site picked so far: ringed and marked with the label. */
          picked: boolean
          /** A tap on the map picks it. */
          pickable: boolean
      }
    | {
          slotId: string
          intent: 'travel'
          cost: number | undefined
          toll: string
          /** Each way to pay, once per bank Hospitality could gain from there. */
          ways: TravelChoice[]
          /** Its ways to pay are open in the panel, as a map pick opens them. */
          picked: boolean
      }
    /**
     * R-5.5.2 — a site the Campaign can target; `pickable` while its Sites row is listed, that is
     * targeted or allowed with the targets chosen.
     */
    | { slotId: string; intent: 'target'; targeted: boolean; pickable: boolean }
    | { slotId: string; intent: 'moveWarbands' }
    /** R-5.5.7.III — a tap on the map banishes the defeated pawn there. */
    | { slotId: string; intent: 'banish' }
    /** R-11.7, R-11.13-H1 — a site the open Travel question offers: a tap on the map sends it. */
    | ({ slotId: string; intent: 'question' } & Omit<TravelPickSite, 'siteId'>)
    /**
     * R-7.1.3 — a site a power in Use a power can take: the words of every row a tap there
     * fills, and whether the panel's one ring is on it.
     */
    | { slotId: string; intent: 'power'; rows: string[]; picked: boolean }

/** Choosing among sites dims the rest of the map: Setup only while its start site is open to a pick. */
export function dimsTheMap(offers: readonly SiteOffer[]): boolean {
    return offers.some((offer) =>
        offer.intent === 'start' ? offer.pickable : offer.intent !== 'moveWarbands'
    )
}

/** R-5.4.2 — every amount the engine accepts, lowest first. */
/** R-1.16 — favor the Chancellor places on one site at setup. */
export type SiteFavor = { siteCardId: string; favor: number }

export type BannerBid = { banner: Banner; amounts: number[] }

/** R-1.23.1 — every faceup site the engine accepts, holding the cards constant. */
export function setupSites(
    state: HydratedOathGameState,
    playerId: string,
    hand: readonly string[],
    siteFavor?: SiteFavor[]
): string[] {
    const [adviserCardId, ...discardOrder] = hand
    if (adviserCardId === undefined) return []
    return state.faceupSiteIds().filter(
        (siteId) =>
            HydratedSetupChoice.reasonCannotResolve(state, playerId, {
                adviserCardId,
                discardOrder,
                siteId,
                siteFavor
            }) === undefined
    )
}

/** R-7.1.4, R-11.12 — one legal way to pay for a Travel, with the Supply it spends. */
export type TravelWay = TravelTerms & { cost: number; discountTolls: string[] }

export function travelWays(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    modifiers: readonly ModifierUse[]
): TravelWay[] {
    const discounts = tollsFor(state, playerId, { kind: 'travel', toSiteId: siteId })
        .filter((t) => t.discount)
        .map((t) => t.cardId)
    return HydratedTravel.legalTerms(state, playerId, siteId, modifiers).map((terms) => ({
        ...terms,
        cost: HydratedTravel.plan(state, playerId, siteId, modifiers, terms.tolls, terms.flipSecret)
            .cost,
        discountTolls: terms.tolls.filter((cardId) => discounts.includes(cardId))
    }))
}

/** The cheapest legal way, as the site's chip reads it. */
export function travelCost(ways: readonly TravelWay[]): number | undefined {
    return ways.length > 0 ? Math.min(...ways.map((way) => way.cost)) : undefined
}

/** R-7.1.4 — the tolls the send attaches (`util/tollDefaults.ts`), named before the tap. */
export function chosenTolls(
    state: HydratedOathGameState,
    playerId: string,
    occasion: TollOccasion
): Toll[] {
    const chosen = defaultTolls(state, playerId, occasion)
    return tollsFor(state, playerId, occasion).filter((t) => chosen.includes(t.cardId))
}

// R-5.4, R-6.3 — relic slots, never card ids: a facedown relic's identity is in the vault.
export function recoverableRelicSlots(
    state: HydratedOathGameState,
    playerId: string,
    modifiers: ModifierUse[]
): string[] {
    const siteId = state.getPlayerState(playerId).siteId
    if (!siteId) return []
    return state
        .relicSlotsAt(siteId)
        .filter(
            (slot) =>
                HydratedRecover.reasonCannotRecover(state, playerId, {
                    modifiers,
                    target: { kind: RecoverTargetKind.Relic, slotId: slot.slotId }
                }) === undefined
        )
        .map((slot) => slot.slotId)
}

// R-5.4.2 — any amount above the banner's value, up to what the player holds. The People's
// Favor's start bank is named here only for the check; the player chooses it before the send.
export function recoverableBanners(
    state: HydratedOathGameState,
    playerId: string,
    modifiers: ModifierUse[]
): BannerBid[] {
    const player = state.getPlayerState(playerId)
    return Object.values(Banner)
        .map((banner) => {
            const held =
                banner === Banner.PeoplesFavor ? usableFavor(state, playerId) : player.secrets
            const amounts = range(1, held).filter(
                (amountPaid) =>
                    reasonCannotRecoverBanner(
                        state,
                        playerId,
                        modifiers,
                        banner,
                        amountPaid,
                        Suit.Discord
                    ) === undefined
            )
            return { banner, amounts }
        })
        .filter(({ amounts }) => amounts.length > 0)
}

export function reasonCannotRecoverBanner(
    state: HydratedOathGameState,
    playerId: string,
    modifiers: ModifierUse[],
    banner: Banner,
    amountPaid: number,
    redistributeFrom: Suit | undefined
): string | undefined {
    return HydratedRecover.reasonCannotRecover(state, playerId, {
        modifiers,
        target: { kind: RecoverTargetKind.Banner, banner },
        amountPaid,
        redistributeFrom
    })
}
