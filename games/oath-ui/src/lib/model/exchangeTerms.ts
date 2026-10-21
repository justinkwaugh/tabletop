import { range } from '@tabletop/common'
import {
    boardToMoveInFrom,
    boardWarbandOwnerOf,
    countOf,
    reasonTransferInvalid,
    sitesRuledBy,
    usableFavor,
    type ExchangeAllowance,
    type ExchangeTerms,
    type ExchangeTransfer,
    type HydratedOathGameState,
    type SiteTransfer,
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
 * of, which the engine moves in, and how many of them there are, once the sites the receiver
 * gives (`givenSites`) have sent theirs home (from revision 11, as the engine counts it).
 */
export function warbandsToMoveIn(
    state: HydratedOathGameState,
    receiverId: string,
    givenSites: readonly SiteTransfer[] = []
): { owner: WarbandOwner | undefined; held: number } {
    const owner = boardWarbandOwnerOf(state, receiverId, givenSites)
    const board = boardToMoveInFrom(state, receiverId, givenSites)
    return { owner, held: owner ? countOf(board, owner) : 0 }
}

/**
 * R-10.8 — the counts of warbands the receiver may move into `siteId` alongside the other sites
 * already counted in `transfer`, which share one board; `inReturn` is what the receiver gives.
 */
export function siteCounts(
    state: HydratedOathGameState,
    giverId: string,
    receiverId: string,
    transfer: ExchangeTransfer,
    siteId: string,
    inReturn: ExchangeTransfer = {}
): number[] {
    const held = warbandsToMoveIn(state, receiverId, inReturn.sites).held
    return range(0, held + 1).filter(
        (warbands) =>
            reasonTransferInvalid(
                state,
                giverId,
                receiverId,
                withSiteWarbands(transfer, siteId, warbands),
                inReturn
            ) === undefined
    )
}

/**
 * Deed Writer, R-10.8 — whether `siteId` could go to `receiverId` once they hand over a site of
 * their own, whose warbands come home to their board before they move in (from revision 11): the
 * engine accepts it with some site of the receiver's given back, and accepts that site given for
 * it. Two empty boards can swap sites this way, each waiting for the other.
 */
function waitsForSiteBack(
    state: HydratedOathGameState,
    giverId: string,
    receiverId: string,
    siteId: string,
    inReturn: ExchangeTransfer
): boolean {
    const given = new Set((inReturn.sites ?? []).map((site) => site.siteId))
    return sitesRuledBy(state, receiverId).some(
        (backId) =>
            !given.has(backId) &&
            siteCounts(state, giverId, receiverId, {}, siteId, {
                ...inReturn,
                ...withSiteWarbands(inReturn, backId, 0)
            }).length > 0 &&
            siteCounts(state, receiverId, giverId, {}, backId, withSiteWarbands({}, siteId, 0))
                .length > 0
    )
}

/**
 * R-10.8 — what `giverId` may promise `receiverId` under a card's `allows`, given what comes back
 * (`inReturn`): a row the engine would refuse alone is not offered, so a stored game keeps its own
 * revision's rules. A site the engine accepts only once the receiver hands over a site of their
 * own is offered with no counts: it waits, picked without a count, until that site is picked.
 */
export function exchangeOffers(
    state: HydratedOathGameState,
    giverId: string,
    receiverId: string,
    allows: ExchangeAllowance,
    viewerId: string | undefined,
    inReturn: ExchangeTransfer = {}
): ExchangeOffers {
    const giver = state.getPlayerState(giverId)
    const allowed = (transfer: ExchangeTransfer) =>
        reasonTransferInvalid(state, giverId, receiverId, transfer, inReturn) === undefined
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
                      counts: siteCounts(state, giverId, receiverId, {}, siteId, inReturn)
                  }))
                  .filter(
                      (site) =>
                          site.counts.length > 0 ||
                          waitsForSiteBack(state, giverId, receiverId, site.siteId, inReturn)
                  )
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

/**
 * R-10.8 — what `side` gives back, as the other side's rows judge it: its transfer, with the
 * sites `giverId` picked but has not counted yet. A site's count never changes the board its old
 * ruler moves in from (their warbands come home whatever comes in), so it is given back at 0
 * until counted.
 */
export function inReturnOf(
    state: HydratedOathGameState,
    picks: ExchangePicks,
    side: ExchangeSide,
    giverId: string
): ExchangeTransfer {
    const transfer = transferOf(picks.terms, side)
    const ruled = new Set(sitesRuledBy(state, giverId))
    const uncounted = picks.uncountedSiteIds.filter((siteId) => ruled.has(siteId))
    if (uncounted.length === 0) return transfer
    return {
        ...transfer,
        sites: [...(transfer.sites ?? []), ...uncounted.map((siteId) => ({ siteId, warbands: 0 }))]
    }
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

/** Anything picked in the terms: something they move, or a site still waiting for its count. */
export function exchangePicked(picks: ExchangePicks): boolean {
    return namesAnything(picks.terms) || picks.uncountedSiteIds.length > 0
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

/**
 * R-10.8 — each side offers what the engine accepts with what the other side gives back, so a
 * change to one side drops from the other every site (counted or not) and adviser its offers no
 * longer list: no row would show such a pick to take it back. A site still listed whose count its
 * row no longer offers keeps its pick and loses its count, so the player picks again and the terms
 * wait for it. A change can alter what the first side offers in turn, so it repeats until both
 * sides stand.
 */
export function withOfferedPicks(
    state: HydratedOathGameState,
    proposerId: string,
    counterpartyId: string,
    allows: ExchangeAllowance,
    viewerId: string | undefined,
    picks: ExchangePicks
): ExchangePicks {
    const sides = [
        { side: 'fromProposer', giver: proposerId, receiver: counterpartyId, back: 'fromCounterparty' },
        { side: 'fromCounterparty', giver: counterpartyId, receiver: proposerId, back: 'fromProposer' }
    ] as const
    // Each pass drops a pick or clears a count and never adds one, so it ends.
    let kept = picks
    let dropped = true
    while (dropped) {
        dropped = false
        for (const { side, giver, receiver, back } of sides) {
            const inReturn = inReturnOf(state, kept, back, receiver)
            const offers = exchangeOffers(state, giver, receiver, allows, viewerId, inReturn)
            const offeredSites = new Set(offers.sites.map((site) => site.siteId))
            const offeredRows = new Set(offers.advisers.map((adviser) => adviser.row))
            // An uncounted site is not in the terms yet; the giver's rule names its side.
            const ruled = new Set(sitesRuledBy(state, giver))
            const transfer = transferOf(kept.terms, side)
            const listed = (transfer.sites ?? []).filter((site) => offeredSites.has(site.siteId))
            // Each count is read as its row reads it, beside the other sites counted with it.
            const stale = listed.filter(
                (site) =>
                    !siteCounts(
                        state,
                        giver,
                        receiver,
                        { sites: listed },
                        site.siteId,
                        inReturn
                    ).includes(site.warbands)
            )
            const sites = listed.filter((site) => !stale.includes(site))
            const patch: Partial<ExchangeTransfer> = {}
            if (sites.length !== (transfer.sites?.length ?? 0)) patch.sites = sites
            if (transfer.adviserRows?.some((row) => !offeredRows.has(row)))
                patch.adviserRows = transfer.adviserRows.filter((row) => offeredRows.has(row))
            const uncountedSiteIds = [
                ...kept.uncountedSiteIds.filter(
                    (siteId) => !ruled.has(siteId) || offeredSites.has(siteId)
                ),
                ...stale.map((site) => site.siteId)
            ]
            const unchanged =
                Object.keys(patch).length === 0 &&
                uncountedSiteIds.length === kept.uncountedSiteIds.length
            if (unchanged) continue
            dropped = true
            kept = {
                terms: Object.keys(patch).length === 0 ? kept.terms : withTransfer(kept.terms, side, patch),
                uncountedSiteIds
            }
        }
    }
    return kept
}
