import { range } from '@tabletop/common'
import {
    Banner,
    HydratedRecover,
    HydratedSetupChoice,
    HydratedTrade,
    HydratedTravel,
    RecoverTargetKind,
    Suit,
    TradeOption,
    defaultTolls,
    tollsFor,
    usableFavor,
    type HydratedOathGameState,
    type ModifierUse,
    type PeekTarget,
    type Toll,
    type TollOccasion,
    type TravelTerms
} from '@tabletop/oath'

export type BoardPick = { sites: string[]; label: string }
export type SiteOffer =
    | { slotId: string; intent: 'start'; label: string }
    | { slotId: string; intent: 'travel'; cost: number | undefined; toll: string }
    | { slotId: string; intent: 'target'; targeted: boolean }
    | { slotId: string; intent: 'moveWarbands' }

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

/** R-5.3.2 — Trade's legality is per option. */
export function tradeOptions(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    modifiers: ModifierUse[]
): TradeOption[] {
    const tolls = defaultTolls(state, playerId, { kind: 'trade', cardId })
    return [TradeOption.ForFavor, TradeOption.ForSecrets].filter(
        (option) =>
            HydratedTrade.reasonCannotTrade(state, playerId, cardId, option, modifiers, tolls) ===
            undefined
    )
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

export function peekSlots(targets: readonly PeekTarget[]): string[] {
    return targets.map((target) => target.slotId)
}
