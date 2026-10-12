import { range } from '@tabletop/common'
import {
    boardWarbandOwnerOf,
    countOf,
    reasonTransferInvalid,
    sitesRuledBy,
    usableFavor,
    type ExchangeAllowance,
    type ExchangeTerms,
    type ExchangeTransfer,
    type HydratedOathGameState,
    type WarbandOwner
} from '@tabletop/oath'
import { offerableAdviserRows, type AdviserRowOffer } from './questionChoices.js'

export type ExchangeSide = keyof ExchangeTerms

/** The editor's picks: the terms, and the sites picked whose count of warbands is not picked yet. */
export type ExchangePicks = { terms: ExchangeTerms; uncountedSiteIds: string[] }

export function noExchangePicks(): ExchangePicks {
    return { terms: {}, uncountedSiteIds: [] }
}

/** A count picked from the pieces themselves: one per unit held, the first `addable` reachable. */
export type PieceCount = { held: number; addable: number }

/** R-10.8 — a site the giver rules, with every count of warbands the receiver may move in. */
export type SiteOffer = { siteId: string; cardId?: string; counts: number[] }

/** What one side may put in the terms, each row as the engine's own check of it accepts it. */
export type ExchangeOffers = {
    favor: PieceCount
    secrets: PieceCount
    relicIds: string[]
    sites: SiteOffer[]
    advisers: AdviserRowOffer[]
}

/** The highest count up to `held` the rules allow, counting down from `held`. */
export function addableCount(held: number, allowed: (count: number) => boolean): number {
    let addable = held
    while (addable > 0 && !allowed(addable)) addable--
    return addable
}

/**
 * R-10.8 — "new ruler moves warbands from board": the warbands the receiver's board holds most
 * of, which the engine moves in, and how many of them there are.
 */
export function warbandsToMoveIn(
    state: HydratedOathGameState,
    receiverId: string
): { owner: WarbandOwner | undefined; held: number } {
    const owner = boardWarbandOwnerOf(state, receiverId)
    const board = state.getPlayerState(receiverId).warbandsOnBoard
    return { owner, held: owner ? countOf(board, owner) : 0 }
}

/**
 * R-10.8 — the counts of warbands the receiver may move into `siteId` alongside the other sites
 * already counted in `transfer`, which share one board.
 */
export function siteCounts(
    state: HydratedOathGameState,
    giverId: string,
    receiverId: string,
    transfer: ExchangeTransfer,
    siteId: string
): number[] {
    return range(0, warbandsToMoveIn(state, receiverId).held + 1).filter(
        (warbands) =>
            reasonTransferInvalid(
                state,
                giverId,
                receiverId,
                withSiteWarbands(transfer, siteId, warbands)
            ) === undefined
    )
}

/**
 * R-10.8 — what `giverId` may promise `receiverId` under a card's `allows`: a row the engine
 * would refuse alone is not offered, so a stored game keeps its own revision's rules.
 */
export function exchangeOffers(
    state: HydratedOathGameState,
    giverId: string,
    receiverId: string,
    allows: ExchangeAllowance,
    viewerId: string | undefined
): ExchangeOffers {
    const giver = state.getPlayerState(giverId)
    const allowed = (transfer: ExchangeTransfer) =>
        reasonTransferInvalid(state, giverId, receiverId, transfer) === undefined
    const favor = usableFavor(state, giverId)
    return {
        favor: { held: favor, addable: addableCount(favor, (n) => allowed({ favor: n })) },
        secrets: {
            held: giver.secrets,
            addable: addableCount(giver.secrets, (n) => allowed({ secrets: n }))
        },
        relicIds: allows.relics ? giver.relicIds : [],
        sites: allows.sites
            ? sitesRuledBy(state, giverId)
                  .map((siteId) => ({
                      siteId,
                      cardId: state.siteCardAt(siteId),
                      counts: siteCounts(state, giverId, receiverId, {}, siteId)
                  }))
                  .filter((site) => site.counts.length > 0)
            : [],
        advisers: allows.advisers
            ? offerableAdviserRows(state, giverId, viewerId).filter((adviser) =>
                  allowed({ adviserRows: [adviser.row] })
              )
            : []
    }
}

export function transferOf(terms: ExchangeTerms, side: ExchangeSide): ExchangeTransfer {
    return terms[side] ?? {}
}

export function withTransfer(
    terms: ExchangeTerms,
    side: ExchangeSide,
    patch: Partial<ExchangeTransfer>
): ExchangeTerms {
    return { ...terms, [side]: { ...transferOf(terms, side), ...patch } }
}

/** Whether the terms move anything at all, from either side. */
function namesAnything(terms: ExchangeTerms): boolean {
    return [terms.fromProposer, terms.fromCounterparty].some(
        (transfer) =>
            transfer !== undefined &&
            ((transfer.favor ?? 0) > 0 ||
                (transfer.secrets ?? 0) > 0 ||
                (transfer.relicCardIds?.length ?? 0) > 0 ||
                (transfer.sites?.length ?? 0) > 0 ||
                (transfer.adviserRows?.length ?? 0) > 0)
    )
}

/** "Use" and "Propose" wait for terms that move something, every picked site counted. */
export function exchangeComplete(picks: ExchangePicks): boolean {
    return namesAnything(picks.terms) && picks.uncountedSiteIds.length === 0
}

export function toggled<T>(list: readonly T[] | undefined, item: T, on: boolean): T[] {
    const set = new Set(list)
    if (on) set.add(item)
    else set.delete(item)
    return [...set]
}

/** Deed Writer — how many of the receiver's warbands move into a site handed over, if it is. */
export function siteWarbandsIn(transfer: ExchangeTransfer, siteId: string): number | undefined {
    return transfer.sites?.find((site) => site.siteId === siteId)?.warbands
}

export function withSiteWarbands(
    transfer: ExchangeTransfer,
    siteId: string,
    warbands: number | undefined
): Pick<ExchangeTransfer, 'sites'> {
    const rest = (transfer.sites ?? []).filter((site) => site.siteId !== siteId)
    return { sites: warbands === undefined ? rest : [...rest, { siteId, warbands }] }
}

export function isSitePicked(picks: ExchangePicks, side: ExchangeSide, siteId: string): boolean {
    return (
        picks.uncountedSiteIds.includes(siteId) ||
        siteWarbandsIn(transferOf(picks.terms, side), siteId) !== undefined
    )
}

/**
 * A site is picked with no count, unless one count alone is legal, which it is picked with; a
 * second tap takes it out, counted or not.
 */
export function withSitePicked(
    picks: ExchangePicks,
    side: ExchangeSide,
    siteId: string,
    counts: readonly number[],
    on: boolean
): ExchangePicks {
    if (!on) return withSiteEntry(picks, side, siteId, undefined, false)
    return withSiteCount(picks, side, siteId, counts.length === 1 ? counts[0] : undefined)
}

/** A picked site's count; with none, the site stays picked and the terms wait for it. */
export function withSiteCount(
    picks: ExchangePicks,
    side: ExchangeSide,
    siteId: string,
    warbands: number | undefined
): ExchangePicks {
    return withSiteEntry(picks, side, siteId, warbands, warbands === undefined)
}

function withSiteEntry(
    picks: ExchangePicks,
    side: ExchangeSide,
    siteId: string,
    warbands: number | undefined,
    uncounted: boolean
): ExchangePicks {
    const transfer = transferOf(picks.terms, side)
    return {
        terms: withTransfer(picks.terms, side, withSiteWarbands(transfer, siteId, warbands)),
        uncountedSiteIds: toggled(picks.uncountedSiteIds, siteId, uncounted)
    }
}

/**
 * A tap on the Nth piece sets the count to N; a tap on the piece at the count sets 0, or the
 * floor where the count may not go under one (a banner's least bid).
 */
export function tappedCount(picked: number, tapped: number, floor = 0): number {
    return tapped === picked ? floor : tapped
}

/**
 * A site's count from its warband pieces: a tap on the piece at the count sets 0 where 0 is legal
 * (the Bandit Crown's holder), and otherwise leaves the site picked with no count.
 */
export function tappedSiteCount(
    counts: readonly number[],
    picked: number | undefined,
    tapped: number
): number | undefined {
    if (tapped !== picked) return tapped
    return counts.includes(0) ? 0 : undefined
}
