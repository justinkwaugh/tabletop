import { bannerHolder } from './oathkeeper.js'
import { assert, assertExists } from '@tabletop/common'
import { giveFavor, usableFavor } from './favor.js'
import { HydratedOathGameState } from '../model/gameState.js'
import {
    MAX_OPEN_DEALS_PER_PLAYER,
    type ExchangeAllowance,
    type ExchangeTerms,
    type ExchangeTransfer,
    type OpenDeal,
    type SiteTransfer
} from '../model/question.js'
import { rulesSite, rulingWarbandOwners, actsAsIfBanditsAreWarbands, warbandsAt } from './rule.js'
import { reasonCannotMoveCardTo } from './locked.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import { addWarbandsToBoard, addWarbandsToSite, removeWarbandsFrom } from './force.js'
import {
    advisersTowardLimit,
    arrivesIgnoringAdviserLimit,
    cannotPlaceWarbandsAtSites,
    countsTowardAdviserLimit,
    effectiveAdviserLimit,
    holdingExcess
} from './continuous.js'
import { giveRelic } from './relics.js'
import type { CitizenshipTransfer } from '../model/citizenship.js'
import { countOf } from './warbands.js'
import type { WarbandCounts, WarbandOwner } from '../model/warbandCounts.js'
import { reasonPersistentForbidsGivingSecrets } from './persistent.js'
import { handedOver, type AdviserRow, type KnownAdviser } from '../model/playerState.js'
import type { AdvisersMoved } from './adviserLimit.js'

export const TINKERS_FAIR_ALLOWS: ExchangeAllowance = { relics: true }
export const DEED_WRITER_ALLOWS: ExchangeAllowance = { sites: true }
export const GATHERING_ALLOWS: ExchangeAllowance = { relics: true, advisers: true }
/** R-11.9 — favor and secrets, and the promises the players write (R-7.6.3-H1). */
export const TRIBUNAL_ALLOWS: ExchangeAllowance = { promises: true }

/** R-7.6.3-H1 — what a card's exchange may carry in this game: promises from revision 28 only. */
export function exchangeAllowanceAt(
    state: HydratedOathGameState,
    allows: ExchangeAllowance
): ExchangeAllowance {
    return allows.promises && !isAtLeastOathRevision(state, OathRevision.EngineFixes24)
        ? { ...allows, promises: false }
        : allows
}

/** A control character other than a line break (C0, DEL and C1). */
function hasControlCharacter(text: string): boolean {
    for (const character of text) {
        const code = character.codePointAt(0) ?? 0
        if (code !== 0x0a && (code < 0x20 || (code >= 0x7f && code < 0xa0))) return true
    }
    return false
}

/**
 * R-7.6.3-H1 — a promise as its player wrote it: trimmed, with line breaks and no other control
 * character (its length is the schema's). Read only where the proposal is made, by its player.
 */
function reasonPromiseTextInvalid(text: string | undefined): string | undefined {
    if (text === undefined) return undefined
    if (text !== text.trim()) return 'a promise cannot start or end with a space'
    if (hasControlCharacter(text)) return 'a promise holds only text and line breaks'
    return undefined
}

export function reasonTermsOutsideCard(
    terms: ExchangeTerms,
    allows: ExchangeAllowance
): string | undefined {
    const promises = terms.promises
    if (promises) {
        if (!allows.promises) return 'this exchange cannot include promises'
        // The object is present only with a promise in it, so later checks need not read the words.
        if (promises.fromProposer === undefined && promises.fromCounterparty === undefined)
            return 'a promise needs its words'
        const reason =
            reasonPromiseTextInvalid(promises.fromProposer) ??
            reasonPromiseTextInvalid(promises.fromCounterparty)
        if (reason) return reason
    }
    for (const side of [terms.fromProposer, terms.fromCounterparty]) {
        if (!side) continue
        if (!allows.relics && (side.relicCardIds?.length ?? 0) > 0)
            return 'this exchange cannot include relics'
        if (!allows.sites && (side.sites?.length ?? 0) > 0)
            return 'this exchange cannot include sites'
        if (!allows.advisers && (side.adviserRows?.length ?? 0) > 0)
            return 'this exchange cannot include advisers'
    }
    return undefined
}

function isEmptyTransfer(t?: ExchangeTransfer): boolean {
    return (
        !t ||
        (!(t.favor ?? 0) &&
            !(t.secrets ?? 0) &&
            !t.relicCardIds?.length &&
            !t.sites?.length &&
            !t.adviserRows?.length)
    )
}

/** R-7.6.3-H1 — the open deals a player is party to, on either side. */
export function openDealsOf(state: HydratedOathGameState, playerId: string): OpenDeal[] {
    return (state.openDeals ?? []).filter(
        (deal) => deal.proposerPlayerId === playerId || deal.counterpartyPlayerId === playerId
    )
}

/**
 * R-7.6.3-H1 — the deal an accepted exchange with a promise in it opens. It reads the promises, so
 * on a player's own view it defers to the host.
 */
export function openDealFrom(
    state: HydratedOathGameState,
    proposerPlayerId: string,
    counterpartyPlayerId: string,
    terms: ExchangeTerms
): OpenDeal | undefined {
    const promises = terms.promises
    if (!promises) return undefined
    const { fromProposer, fromCounterparty } = promises
    return {
        id: `${state.round}.${state.actionCount}`,
        proposerPlayerId,
        counterpartyPlayerId,
        ...(fromProposer !== undefined ? { proposerPromise: fromProposer } : {}),
        ...(fromCounterparty !== undefined ? { counterpartyPromise: fromCounterparty } : {}),
        round: state.round
    }
}

export function reasonExchangeInvalid(
    state: HydratedOathGameState,
    proposerId: string,
    counterpartyId: string,
    terms: ExchangeTerms
): string | undefined {
    if (proposerId === counterpartyId) return 'an exchange needs two players'
    if (!state.findPlayerState(counterpartyId)) return `no such player ${counterpartyId}`
    // R-7.6.3-H1 — at the Tribunal a promise alone is something exchanged. Its presence says so
    // without reading the words, which only the two players may (`ExchangePartyPolicy`).
    const promised = terms.promises !== undefined
    if (!promised && isEmptyTransfer(terms.fromProposer) && isEmptyTransfer(terms.fromCounterparty))
        return 'the exchange is empty'
    if (promised) {
        const full = [proposerId, counterpartyId].find(
            (playerId) => openDealsOf(state, playerId).length >= MAX_OPEN_DEALS_PER_PLAYER
        )
        if (full) return `${full} already has five open deals`
    }
    // R-10.8 — "and vice versa": each side is judged with what comes back in the same exchange.
    return (
        reasonTransferInvalid(
            state,
            proposerId,
            counterpartyId,
            terms.fromProposer,
            terms.fromCounterparty
        ) ??
        reasonTransferInvalid(
            state,
            counterpartyId,
            proposerId,
            terms.fromCounterparty,
            terms.fromProposer
        )
    )
}

/** R-10.8, R-6.6.1 */
export type Transfer = ExchangeTransfer & CitizenshipTransfer

/**
 * R-10.8 — what `fromId` promises `toId` must be theirs to give when the promise is made.
 * `inReturn` is what `toId` gives `fromId` in the same exchange, when the terms are known.
 */
export function reasonTransferInvalid(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    transfer?: Transfer,
    inReturn?: ExchangeTransfer
): string | undefined {
    if (!transfer) return undefined
    const from = state.getPlayerState(fromId)
    const to = state.getPlayerState(toId)
    const favor = transfer.favor ?? 0
    if (!Number.isInteger(favor) || favor < 0) return 'a promised amount cannot be negative'
    const usable = usableFavor(state, fromId)
    if (usable < favor) return `${fromId} promised ${favor} favor, with only ${usable} usable`
    const secrets = transfer.secrets ?? 0
    if (!Number.isInteger(secrets) || secrets < 0) return 'a promised amount cannot be negative'
    // R-7.1.2.a — facedown secrets cannot be handed over, so only the faceup count is checked.
    if (from.secrets < secrets)
        return `${fromId} promised ${secrets} secrets, holding only ${from.secrets}`
    if (secrets > 0) {
        const silenced = reasonPersistentForbidsGivingSecrets(state, fromId)
        if (silenced) return silenced
    }
    // Each relic, banner and site changes hands once.
    const once = (ids: readonly string[]) => new Set(ids).size === ids.length
    if (!once(transfer.relicCardIds ?? [])) return `${fromId} promised the same relic twice`
    if (!once(transfer.banners ?? [])) return `${fromId} promised the same banner twice`
    if (!once((transfer.sites ?? []).map((site) => site.siteId))) {
        return `${fromId} promised the same site twice`
    }
    for (const cardId of transfer.relicCardIds ?? []) {
        if (!from.relicIds.includes(cardId))
            return `${fromId} promised ${cardId} without holding it`
    }
    for (const banner of transfer.banners ?? []) {
        if (bannerHolder(state, banner) !== fromId)
            return `${fromId} promised the ${banner} without holding it`
    }
    const sites = transfer.sites ?? []
    // R-X.4 — a game created before this revision checked each site alone against the whole board.
    const summed = isAtLeastOathRevision(state, OathRevision.EngineFixes2)
    for (const site of sites) {
        if (!rulesSite(state, fromId, site.siteId))
            return `${fromId} promised ${site.siteId} without ruling it`
        // Deed Writer's Q&A: a Citizen and the Chancellor cannot exchange sites, "since you both rule them already".
        if (
            isAtLeastOathRevision(state, OathRevision.EngineFixes2) &&
            rulesSite(state, toId, site.siteId)
        ) {
            return `${toId} already rules ${site.siteId}`
        }
        // Deed Writer's Q&A: "not zero unless they have the Bandit Crown" (R-7.6.5).
        const fewest = actsAsIfBanditsAreWarbands(state, toId) ? 0 : 1
        // R-7.1.4-H1 Ring of Devotion: "You cannot place warbands at sites", and its Q&A covers
        // "All of them!". Without the Bandit Crown every count places some, so no site is taken.
        if (
            isAtLeastOathRevision(state, OathRevision.EngineFixes5) &&
            (fewest > 0 || site.warbands > 0) &&
            cannotPlaceWarbandsAtSites(state, toId)
        ) {
            return `${toId} cannot place warbands at sites (Ring of Devotion)`
        }
        if (!Number.isInteger(site.warbands) || site.warbands < fewest) {
            return fewest === 0
                ? 'a promised amount cannot be negative'
                : `${toId} must move at least one warband to ${site.siteId}`
        }
        if (summed) continue
        const owner = boardWarbandOwnerOf(state, toId)
        if (!owner || countOf(to.warbandsOnBoard, owner) < site.warbands) {
            return `${toId}'s board has fewer than ${site.warbands} warbands to move to ${site.siteId}`
        }
    }
    if (summed) {
        const board = boardToMoveInFrom(state, toId, inReturn?.sites ?? [])
        const moves = movesFromBoard(state, toId, sites, board)
        if (moves.length < sites.length) {
            const covered = sites.slice(0, moves.length + 1)
            const needed = covered.reduce((sum, site) => sum + site.warbands, 0)
            const siteIds = covered.map((site) => site.siteId).join(', ')
            return `${toId}'s board has fewer than ${needed} warbands to move to ${siteIds}`
        }
    }
    // R-9.4 — read from the public rows alone, so an answer never tells what a facedown card is.
    const rows = transfer.adviserRows ?? []
    if (new Set(rows).size !== rows.length) return `${fromId} promised the same adviser twice`
    for (const row of rows) {
        const adviser = from.advisers[row]
        if (adviser === undefined) return `${fromId} has no adviser in row ${row + 1}`
        // R-7.2 — a facedown adviser shows no restriction banner, so only a faceup one is locked (R-7.2.2).
        if (adviser.faceUp && isAtLeastOathRevision(state, OathRevision.EngineFixes2)) {
            assertExists(adviser.cardId, 'A faceup adviser row names its card')
            const unmovable = reasonCannotMoveCardTo(state, fromId, adviser.cardId, 'advisers')
            if (unmovable) return unmovable
        }
    }
    // R-X.4 — from revision 11 an exchange that ends over the limit asks a discard once applied.
    if (rows.length > 0 && !isAtLeastOathRevision(state, OathRevision.EngineFixes7)) {
        // R-7.2.1 — the receiver's adviser limit, counted as Search counts it.
        const incoming = rows.filter((row) => {
            const adviser = from.advisers[row]
            if (!adviser.faceUp) return true
            assertExists(adviser.cardId, 'A faceup adviser row names its card')
            // Pied Piper arriving counts toward no limit, as before revision 11; held, it counts.
            return (
                !arrivesIgnoringAdviserLimit(state, adviser.cardId) &&
                countsTowardAdviserLimit(state, toId, adviser.cardId, true)
            )
        }).length
        // R-10.8 — and refused only if the receiver also ends over on the exchange's result, so a
        // swap at the limit or Family Wagon given away passes; what was accepted stays accepted.
        if (
            advisersTowardLimit(state, toId) + incoming > effectiveAdviserLimit(state, toId) &&
            adviserExcessAfterExchange(state, toId, inReturn, fromId, transfer) > 0
        ) {
            return `${toId} cannot hold ${incoming} more advisers`
        }
    }
    return undefined
}

/**
 * R-10.8, R-7.6.4 — how far over the adviser limit `playerId` stands once the exchange has moved
 * advisers and relics both ways: they give `gives`, and `otherId` gives them `gets`. Read from the
 * public rows (R-9.4), so every view judges it alike.
 */
function adviserExcessAfterExchange(
    state: HydratedOathGameState,
    playerId: string,
    gives: ExchangeTransfer | undefined,
    otherId: string,
    gets: ExchangeTransfer | undefined
): number {
    const player = state.getPlayerState(playerId)
    const other = state.getPlayerState(otherId)
    const leaving = new Set(gives?.adviserRows ?? [])
    const kept = player.advisers.filter((_, row) => !leaving.has(row))
    const arriving = (gets?.adviserRows ?? []).flatMap((row) => other.advisers[row] ?? [])
    const faceupIds = (rows: readonly AdviserRow[]) =>
        rows.flatMap((row) => (row.faceUp && row.cardId !== undefined ? [row.cardId] : []))
    const rows = [...kept, ...arriving]
    const givenRelics = gives?.relicCardIds ?? []
    return holdingExcess(
        state,
        {
            faceup: faceupIds(rows),
            facedown: rows.filter((row) => !row.faceUp).length,
            relicIds: [
                ...player.relicIds.filter((cardId) => !givenRelics.includes(cardId)),
                ...(gets?.relicCardIds ?? [])
            ],
            baseLimit: player.adviserLimit
        },
        faceupIds(arriving)
    )
}

/**
 * R-10.8 — the warbands a new ruler moves in: whichever of theirs their board holds most of,
 * once the sites they give in the same exchange have sent theirs home.
 */
export function boardWarbandOwnerOf(
    state: HydratedOathGameState,
    playerId: string,
    givenSites: readonly SiteTransfer[] = []
): WarbandOwner | undefined {
    return mostHeld(
        rulingWarbandOwners(state, playerId),
        boardToMoveInFrom(state, playerId, givenSites)
    )
}

/**
 * Deed Writer — "Old ruler moves warbands to board, and new ruler moves warbands from board": the
 * board `playerId` moves warbands in from, with the warbands on the sites they give in the same
 * exchange (`givenSites`) already home. From revision 11; before it the board as it stands, since
 * each side's sites were moved in turn. Read from the public board and sites.
 */
export function boardToMoveInFrom(
    state: HydratedOathGameState,
    playerId: string,
    givenSites: readonly SiteTransfer[]
): WarbandCounts {
    const board: WarbandCounts = { ...state.getPlayerState(playerId).warbandsOnBoard }
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes7)) return board
    for (const { siteId } of givenSites) {
        const onSite = warbandsAt(state, siteId)
        for (const owner of rulingWarbandOwners(state, playerId)) {
            const n = countOf(onSite, owner)
            if (n > 0) board[owner] = countOf(board, owner) + n
        }
    }
    return board
}

function mostHeld(
    owners: readonly WarbandOwner[],
    counts: Readonly<WarbandCounts>
): WarbandOwner | undefined {
    return [...owners].sort((a, b) => countOf(counts, b) - countOf(counts, a))[0]
}

interface BoardMove {
    siteId: string
    owner: WarbandOwner
    warbands: number
}

/**
 * R-10.8 — "new ruler moves warbands from board": one board pays for every site, in the order the
 * terms list them, each site taking whichever of the new ruler's warbands the board then holds
 * most of. Stops at the first site the board cannot fill, so a shorter list means it runs short.
 */
function movesFromBoard(
    state: HydratedOathGameState,
    toId: string,
    sites: readonly SiteTransfer[],
    board: Readonly<WarbandCounts>
): BoardMove[] {
    const owners = rulingWarbandOwners(state, toId)
    const left: WarbandCounts = { ...board }
    const moves: BoardMove[] = []
    for (const site of sites) {
        const owner = mostHeld(owners, left)
        if (!owner || countOf(left, owner) < site.warbands) break
        left[owner] = countOf(left, owner) - site.warbands
        moves.push({ siteId: site.siteId, owner, warbands: site.warbands })
    }
    return moves
}

/** What an exchange did that its caller acts on. */
export interface ExchangeApplied {
    /** A facedown adviser changed hands. */
    disclosed: boolean
    /** The players whose advisers changed, and the cards each received. */
    advisersMoved: AdvisersMoved[]
}

/**
 * R-10.8 — the caller validates first. From revision 11 the sites move in Deed Writer's order
 * across both sides ("Old ruler moves warbands to board, and new ruler moves warbands from
 * board"): every site handed over sends its old ruler's warbands home before any new ruler moves
 * in. Before it each side's sites moved in turn, the proposer's first, as the game was recorded.
 */
export function applyExchange(
    state: HydratedOathGameState,
    proposerId: string,
    counterpartyId: string,
    terms: ExchangeTerms
): ExchangeApplied {
    const inTurn = !isAtLeastOathRevision(state, OathRevision.EngineFixes7)
    const fromProposer = applyTransfer(
        state,
        proposerId,
        counterpartyId,
        terms.fromProposer,
        inTurn
    )
    const fromCounterparty = applyTransfer(
        state,
        counterpartyId,
        proposerId,
        terms.fromCounterparty,
        inTurn
    )
    if (!inTurn) {
        const sides = [
            { fromId: proposerId, toId: counterpartyId, sites: terms.fromProposer?.sites ?? [] },
            { fromId: counterpartyId, toId: proposerId, sites: terms.fromCounterparty?.sites ?? [] }
        ]
        for (const { fromId, sites } of sides) {
            for (const { siteId } of sites) sendWarbandsHome(state, fromId, siteId)
        }
        for (const { toId, sites } of sides) moveWarbandsIn(state, toId, sites)
    }
    return exchangeApplied(proposerId, counterpartyId, fromProposer, fromCounterparty)
}

/** R-10.8 — "Old ruler moves warbands to board": all of theirs on the site. */
function sendWarbandsHome(state: HydratedOathGameState, fromId: string, siteId: string): void {
    const onSite = warbandsAt(state, siteId)
    for (const owner of rulingWarbandOwners(state, fromId)) {
        const n = countOf(onSite, owner)
        if (n <= 0) continue
        removeWarbandsFrom(state, { kind: 'site', siteId }, owner, n)
        addWarbandsToBoard(state, fromId, owner, n)
    }
}

/** Before revision 11: site by site, the old ruler's warbands go home and the new ruler's go in. */
function moveSitesInTurn(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    sites: readonly SiteTransfer[]
): void {
    const moves = movesFromBoard(state, toId, sites, state.getPlayerState(toId).warbandsOnBoard)
    assert(moves.length === sites.length, `${toId}'s board cannot fill every site promised`)
    for (const move of moves) {
        sendWarbandsHome(state, fromId, move.siteId)
        removeWarbandsFrom(state, { kind: 'board', playerId: toId }, move.owner, move.warbands)
        addWarbandsToSite(state, move.siteId, move.owner, move.warbands)
    }
}

/** R-10.8 — "…and new ruler moves warbands from board". */
function moveWarbandsIn(
    state: HydratedOathGameState,
    toId: string,
    sites: readonly SiteTransfer[]
): void {
    const board = state.getPlayerState(toId).warbandsOnBoard
    const moves = movesFromBoard(state, toId, sites, board)
    assert(moves.length === sites.length, `${toId}'s board cannot fill every site promised`)
    for (const move of moves) {
        removeWarbandsFrom(state, { kind: 'board', playerId: toId }, move.owner, move.warbands)
        addWarbandsToSite(state, move.siteId, move.owner, move.warbands)
    }
}

function exchangeApplied(
    proposerId: string,
    counterpartyId: string,
    fromProposer: readonly KnownAdviser[],
    fromCounterparty: readonly KnownAdviser[]
): ExchangeApplied {
    const moved = [...fromProposer, ...fromCounterparty]
    const cardIds = (advisers: readonly KnownAdviser[]) => advisers.map(({ cardId }) => cardId)
    return {
        disclosed: moved.some((adviser) => !adviser.faceUp),
        advisersMoved:
            moved.length === 0
                ? []
                : [
                      { playerId: proposerId, receivedCardIds: cardIds(fromCounterparty) },
                      { playerId: counterpartyId, receivedCardIds: cardIds(fromProposer) }
                  ]
    }
}

/**
 * Returns the advisers that went from `fromId` to `toId`. The sites move here only when each side
 * moves its sites `inTurn` (before revision 11).
 */
function applyTransfer(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    transfer: ExchangeTransfer | undefined,
    inTurn: boolean
): KnownAdviser[] {
    if (!transfer) return []
    const from = state.getPlayerState(fromId)
    const to = state.getPlayerState(toId)
    giveFavor(state, fromId, toId, transfer.favor ?? 0)
    const secrets = transfer.secrets ?? 0
    from.secrets -= secrets
    to.secrets += secrets
    for (const cardId of transfer.relicCardIds ?? []) giveRelic(state, fromId, toId, cardId)
    if (inTurn) moveSitesInTurn(state, fromId, toId, transfer.sites ?? [])
    // Resolved by the host, which alone knows what a facedown row holds.
    const moving = (transfer.adviserRows ?? []).map((row) => {
        const adviser = from.knownAdvisers()[row]
        assertExists(adviser, `${fromId} has no adviser in row ${row + 1}`)
        return adviser
    })
    for (const adviser of moving) {
        from.removeAdviser(adviser.cardId)
        to.setAdvisers([...to.knownAdvisers(), handedOver(adviser, fromId, toId)])
    }
    return moving
}
