import { bannerHolder } from './oathkeeper.js'
import { assert, assertExists } from '@tabletop/common'
import { giveFavor, usableFavor } from './favor.js'
import { HydratedOathGameState } from '../model/gameState.js'
import {
    type ExchangeAllowance,
    type ExchangeTerms,
    type ExchangeTransfer,
    type SiteTransfer
} from '../model/question.js'
import { rulesSite, rulingWarbandOwners, actsAsIfBanditsAreWarbands, warbandsAt } from './rule.js'
import { reasonCannotMoveCardTo } from './locked.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import { addWarbandsToBoard, addWarbandsToSite, removeWarbandsFrom } from './force.js'
import {
    advisersTowardLimit,
    countsTowardAdviserLimit,
    effectiveAdviserLimit
} from './continuous.js'
import { giveRelic } from './relics.js'
import type { CitizenshipTransfer } from '../model/citizenship.js'
import { countOf } from './warbands.js'
import type { WarbandCounts, WarbandOwner } from '../model/warbandCounts.js'
import { reasonPersistentForbidsGivingSecrets } from './persistent.js'
import { handedOver } from '../model/playerState.js'

export const TINKERS_FAIR_ALLOWS: ExchangeAllowance = { relics: true }
export const DEED_WRITER_ALLOWS: ExchangeAllowance = { sites: true }
export const GATHERING_ALLOWS: ExchangeAllowance = { relics: true, advisers: true }

export function reasonTermsOutsideCard(
    terms: ExchangeTerms,
    allows: ExchangeAllowance
): string | undefined {
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

export function reasonExchangeInvalid(
    state: HydratedOathGameState,
    proposerId: string,
    counterpartyId: string,
    terms: ExchangeTerms
): string | undefined {
    if (proposerId === counterpartyId) return 'an exchange needs two players'
    if (!state.findPlayerState(counterpartyId)) return `no such player ${counterpartyId}`
    if (isEmptyTransfer(terms.fromProposer) && isEmptyTransfer(terms.fromCounterparty))
        return 'the exchange is empty'
    return (
        reasonTransferInvalid(state, proposerId, counterpartyId, terms.fromProposer) ??
        reasonTransferInvalid(state, counterpartyId, proposerId, terms.fromCounterparty)
    )
}

/** R-10.8, R-6.6.1 */
export type Transfer = ExchangeTransfer & CitizenshipTransfer

/** R-10.8 — what `fromId` promises `toId` must be theirs to give when the promise is made. */
export function reasonTransferInvalid(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    transfer?: Transfer
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
        const moves = movesFromBoard(state, toId, sites)
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
    if (rows.length > 0) {
        // R-7.2.1 — the receiver's adviser limit, counted as Search counts it.
        const incoming = rows.filter((row) => {
            const adviser = from.advisers[row]
            if (!adviser.faceUp) return true
            assertExists(adviser.cardId, 'A faceup adviser row names its card')
            return countsTowardAdviserLimit(state, toId, adviser.cardId, true)
        }).length
        if (advisersTowardLimit(state, toId) + incoming > effectiveAdviserLimit(state, toId)) {
            return `${toId} cannot hold ${incoming} more advisers`
        }
    }
    return undefined
}

/** R-10.8 — the warbands a new ruler moves in: whichever of theirs their board holds most of. */
export function boardWarbandOwnerOf(
    state: HydratedOathGameState,
    playerId: string
): WarbandOwner | undefined {
    return mostHeld(
        rulingWarbandOwners(state, playerId),
        state.getPlayerState(playerId).warbandsOnBoard
    )
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
    sites: readonly SiteTransfer[]
): BoardMove[] {
    const owners = rulingWarbandOwners(state, toId)
    const left: WarbandCounts = { ...state.getPlayerState(toId).warbandsOnBoard }
    const moves: BoardMove[] = []
    for (const site of sites) {
        const owner = mostHeld(owners, left)
        if (!owner || countOf(left, owner) < site.warbands) break
        left[owner] = countOf(left, owner) - site.warbands
        moves.push({ siteId: site.siteId, owner, warbands: site.warbands })
    }
    return moves
}

/** R-10.8 — the caller validates first; true when a facedown adviser changed hands. */
export function applyExchange(
    state: HydratedOathGameState,
    proposerId: string,
    counterpartyId: string,
    terms: ExchangeTerms
): boolean {
    const fromProposer = applyTransfer(state, proposerId, counterpartyId, terms.fromProposer)
    const fromCounterparty = applyTransfer(
        state,
        counterpartyId,
        proposerId,
        terms.fromCounterparty
    )
    return fromProposer || fromCounterparty
}

function applyTransfer(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    transfer?: ExchangeTransfer
): boolean {
    if (!transfer) return false
    const from = state.getPlayerState(fromId)
    const to = state.getPlayerState(toId)
    giveFavor(state, fromId, toId, transfer.favor ?? 0)
    const secrets = transfer.secrets ?? 0
    from.secrets -= secrets
    to.secrets += secrets
    for (const cardId of transfer.relicCardIds ?? []) giveRelic(state, fromId, toId, cardId)
    const sites = transfer.sites ?? []
    const moves = movesFromBoard(state, toId, sites)
    assert(moves.length === sites.length, `${toId}'s board cannot fill every site promised`)
    for (const move of moves) {
        // R-10.8 — "old ruler moves warbands to board": all of theirs there.
        const onSite = warbandsAt(state, move.siteId)
        for (const owner of rulingWarbandOwners(state, fromId)) {
            const n = countOf(onSite, owner)
            if (n <= 0) continue
            removeWarbandsFrom(state, { kind: 'site', siteId: move.siteId }, owner, n)
            addWarbandsToBoard(state, fromId, owner, n)
        }
        // R-10.8 — "…and new ruler moves warbands from board".
        removeWarbandsFrom(state, { kind: 'board', playerId: toId }, move.owner, move.warbands)
        addWarbandsToSite(state, move.siteId, move.owner, move.warbands)
    }
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
    return moving.some((adviser) => !adviser.faceUp)
}
