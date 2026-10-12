import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandOwner } from '../model/warbandCounts.js'
import type { WarbandGroup, WarbandLocation } from '../model/campaign.js'
import {
    totalWarbands,
    countOf,
    adjustCount,
    countedWarbands,
    describeWarbands,
    warbandEntries
} from './warbands.js'
import { ownWarbandOwner, warbandsAt } from './rule.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'

/** R-10.9 — recorded when computed, since R-5.5.6 moves the board afterwards. */

export function forceTotal(force: readonly WarbandGroup[]): number {
    return force.reduce((sum, group) => sum + group.count, 0)
}

/** R-10.13 — the owner of every warband in the groups, when they are one owner's. */
export function soleOwner(groups: readonly WarbandGroup[]): WarbandOwner | undefined {
    const owners = new Set(groups.filter((group) => group.count > 0).map((group) => group.owner))
    return owners.size === 1 ? [...owners][0] : undefined
}

/** R-10.13 — their own warbands first, then the others on the board: the order losses come from. */
export function boardOwnersOwnFirst(
    state: HydratedOathGameState,
    playerId: string
): WarbandOwner[] {
    const own = ownWarbandOwner(state, playerId)
    return [
        own,
        ...warbandEntries(state.getPlayerState(playerId).warbandsOnBoard)
            .map(([owner]) => owner)
            .filter((owner) => owner !== own)
    ]
}

export function boardWarbandGroups(state: HydratedOathGameState, playerId: string): WarbandGroup[] {
    return warbandEntries(state.getPlayerState(playerId).warbandsOnBoard)
        .filter(([, count]) => count > 0)
        .map(([owner, count]): WarbandGroup => ({ at: { kind: 'board', playerId }, owner, count }))
}

export function warbandGroupsAtSites(
    state: HydratedOathGameState,
    siteIds: readonly string[],
    owners: readonly WarbandOwner[]
): WarbandGroup[] {
    const groups: WarbandGroup[] = []
    for (const siteId of siteIds) {
        const onSite = warbandsAt(state, siteId)
        for (const owner of owners) {
            const count = countOf(onSite, owner)
            if (count > 0) groups.push({ at: { kind: 'site', siteId }, owner, count })
        }
    }
    return groups
}

export function warbandsOnBoardOf(state: HydratedOathGameState, playerId: string): number {
    return totalWarbands(state.getPlayerState(playerId).warbandsOnBoard)
}

/** R-10.13 — the caller removes the warband. */
export function killWarbands(state: HydratedOathGameState, owner: WarbandOwner, count: number) {
    if (count <= 0) return

    const bank = state.getPlayerState(state.warbandBankHolderOf(owner)).warbandsInPersonalBank
    adjustCount(bank, owner, count)
}

export function removeWarbandsFrom(
    state: HydratedOathGameState,
    at: WarbandLocation,
    owner: WarbandOwner,
    count: number
) {
    if (count <= 0) return

    const counts =
        at.kind === 'site'
            ? (state.warbandsBySite[at.siteId] ??= {})
            : state.getPlayerState(at.playerId).warbandsOnBoard

    const available = countOf(counts, owner)
    if (available < count) {
        const where = at.kind === 'site' ? at.siteId : `${at.playerId}'s board`
        throw Error(
            `Cannot take ${describeWarbands(count, owner)} from ${where}: only ${available} there`
        )
    }
    counts[owner] = available - count
}

export function addWarbandsToBoard(
    state: HydratedOathGameState,
    playerId: string,
    owner: WarbandOwner,
    count: number
) {
    if (count <= 0) return
    const board = state.getPlayerState(playerId).warbandsOnBoard
    adjustCount(board, owner, count)
}

export function addWarbandsToSite(
    state: HydratedOathGameState,
    siteId: string,
    owner: WarbandOwner,
    count: number
) {
    if (count <= 0) return
    const counts = (state.warbandsBySite[siteId] ??= {})
    adjustCount(counts, owner, count)
}

export function addWarbandsToCard(
    state: HydratedOathGameState,
    cardId: string,
    owner: WarbandOwner,
    count: number
) {
    if (count <= 0) return
    const onCards = state.warbandsOnCards
    const counts = (onCards[cardId] ??= {})
    adjustCount(counts, owner, count)
}

export function removeWarbandsFromCard(
    state: HydratedOathGameState,
    cardId: string,
    owner: WarbandOwner,
    count: number
) {
    if (count <= 0) return
    const counts = state.warbandsOnCard(cardId)
    const available = countOf(counts, owner)
    if (available < count) {
        throw Error(
            `Cannot take ${describeWarbands(count, owner)} from ${cardId}: only ${available} on it`
        )
    }
    counts[owner] = available - count
}

/** R-10.13 — a card cannot carry warbands out of play, so they return to their banks as it leaves. */
export function returnWarbandsOnCardToBanks(state: HydratedOathGameState, cardId: string) {
    for (const [owner, count] of warbandEntries(state.warbandsOnCard(cardId))) {
        removeWarbandsFromCard(state, cardId, owner, count)
        killWarbands(state, owner, count)
    }
}

/** R-5.5.6, R-5.5.6.a */
export function selectionExceedsForce(
    selection: readonly WarbandGroup[],
    force: readonly WarbandGroup[]
): string | undefined {
    const available = new Map<string, number>()
    for (const group of force) {
        const key = groupKey(group)
        available.set(key, (available.get(key) ?? 0) + group.count)
    }

    const wanted = new Map<string, number>()
    for (const group of selection) {
        const key = groupKey(group)
        wanted.set(key, (wanted.get(key) ?? 0) + group.count)
    }

    for (const [key, count] of wanted) {
        const have = available.get(key)
        if (have === undefined) {
            return `${key} is not in the force`
        }
        if (count > have) {
            return `cannot take ${count} from ${key}: the force holds ${have} there`
        }
    }
    return undefined
}

function groupKey(group: WarbandGroup): string {
    const where =
        group.at.kind === 'site' ? `site ${group.at.siteId}` : `${group.at.playerId}'s board`
    return `${group.owner}'s at ${where}`
}

/** R-5.5.6, R-5.5.7.I — site warbands go to their owner's board, the Empire's to the Chancellor's. */
export function moveForceToBoards(state: HydratedOathGameState, force: readonly WarbandGroup[]) {
    for (const group of force) {
        if (group.at.kind !== 'site') {
            continue
        }
        removeWarbandsFrom(state, group.at, group.owner, group.count)
        addWarbandsToBoard(state, state.warbandBankHolderOf(group.owner), group.owner, group.count)
    }
}

/** R-10.13, R-5.2.2 */
export function warbandsInBankFor(state: HydratedOathGameState, owner: WarbandOwner): number {
    return countOf(
        state.getPlayerState(state.warbandBankHolderOf(owner)).warbandsInPersonalBank,
        owner
    )
}

/** R-9.3 — "as many as possible": may return fewer than asked. */
export function takeWarbandsFromBank(
    state: HydratedOathGameState,
    owner: WarbandOwner,
    count: number
): number {
    if (count <= 0) return 0

    const available = warbandsInBankFor(state, owner)
    const taken = Math.min(count, available)
    if (taken === 0) return 0

    const bank = state.getPlayerState(state.warbandBankHolderOf(owner)).warbandsInPersonalBank
    adjustCount(bank, owner, -taken)
    return taken
}

export function takeFromGroups(groups: readonly WarbandGroup[], limit: number): WarbandGroup[] {
    const taken: WarbandGroup[] = []
    let left = limit
    for (const group of groups) {
        if (left <= 0) break
        const count = Math.min(group.count, left)
        taken.push({ ...group, count })
        left -= count
    }
    return taken
}

/** R-5.2.2, R-6.6.2 — a Citizen has no colour of their own: they gain the Empire's warbands. */
export function warbandOwnerGainedBy(state: HydratedOathGameState, playerId: string): WarbandOwner {
    if (state.getPlayerState(playerId).status === PlayerStatus.Citizen) return IMPERIAL_WARBANDS
    return ownWarbandOwner(state, playerId)
}

/** R-6.6.2, R-X.4 — in games created before revision 5 a power gave a Citizen their own colour. */
export function warbandOwnerGainedByPower(
    state: HydratedOathGameState,
    playerId: string
): WarbandOwner {
    return isAtLeastOathRevision(state, OathRevision.EngineFixes2)
        ? warbandOwnerGainedBy(state, playerId)
        : ownWarbandOwner(state, playerId)
}

/**
 * R-10.13 — from revision 5 a gain's words name the Empire's warbands, so the History draws them in
 * the Chancellor's colour. A player's own stay a bare count, unless the line is read on a row that
 * counts another's warbands. Before revision 5 (R-X.4) the words recorded then stand: `undefined`.
 */
export function gainedWarbandsWords(
    state: HydratedOathGameState,
    playerId: string,
    gained: number,
    own: 'bare' | 'named' = 'bare'
): string | undefined {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes2)) return undefined
    const owner = warbandOwnerGainedByPower(state, playerId)
    if (owner === IMPERIAL_WARBANDS || own === 'named') return describeWarbands(gained, owner)
    return countedWarbands(gained)
}

/**
 * The Obsidian Cage's Q&A, R-6.6.2 — a caged player who is now a Citizen gets Imperial warbands
 * back. In games created before revision 5 (R-X.4) they came back in the player's own colour.
 */
export function cagedReturnAsImperial(state: HydratedOathGameState, owner: WarbandOwner): boolean {
    return (
        isAtLeastOathRevision(state, OathRevision.EngineFixes2) &&
        owner !== IMPERIAL_WARBANDS &&
        state.getPlayerState(owner).status === PlayerStatus.Citizen
    )
}

/** R-10.10 — capped by R-9.3. */
export function gainWarbandsToBoard(
    state: HydratedOathGameState,
    playerId: string,
    count: number
): number {
    return gainWarbandsWithOwner(state, playerId, count).gained
}

/** R-10.10 — from the bank that holds `owner`'s warbands (R-10.13), capped by R-9.3. */
export function gainWarbandsWithOwner(
    state: HydratedOathGameState,
    playerId: string,
    count: number,
    owner: WarbandOwner = warbandOwnerGainedByPower(state, playerId)
): { owner?: WarbandOwner; gained: number } {
    const bank = state.getPlayerState(state.warbandBankHolderOf(owner)).warbandsInPersonalBank
    const available = countOf(bank, owner)
    const gained = Math.max(0, Math.min(count, available))
    bank[owner] = available - gained
    addWarbandsToBoard(state, playerId, owner, gained)
    return { owner: gained > 0 ? owner : undefined, gained }
}

/** R-5.5.6 — every survivor goes to its board, so only owners and boards tell the losses apart. */
export function defeatChoiceMatters(force: readonly WarbandGroup[]): boolean {
    if (new Set(force.map((group) => group.owner)).size > 1) return true
    return force.some((group) => group.at.kind === 'board')
}
