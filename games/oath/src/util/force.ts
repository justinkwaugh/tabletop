import type { Color } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { WarbandGroup, WarbandLocation } from '../model/campaign.js'
import { totalWarbands, countOf, adjustCount, warbandEntries } from './warbands.js'
import { warbandsAt } from './rule.js'

/** R-10.9 — recorded when computed, since R-5.5.6 moves the board afterwards. */

export function forceTotal(force: readonly WarbandGroup[]): number {
    return force.reduce((sum, group) => sum + group.count, 0)
}

/** R-10.13 — own colour first, then the other colours on the board: the order losses come from. */
export function boardColorsOwnFirst(state: HydratedOathGameState, playerId: string): Color[] {
    const player = state.getPlayerState(playerId)
    return [
        player.color,
        ...warbandEntries(player.warbandsOnBoard)
            .map(([color]) => color)
            .filter((color) => color !== player.color)
    ]
}

export function boardWarbandGroups(state: HydratedOathGameState, playerId: string): WarbandGroup[] {
    return warbandEntries(state.getPlayerState(playerId).warbandsOnBoard)
        .filter(([, count]) => count > 0)
        .map(([color, count]): WarbandGroup => ({ at: { kind: 'board', playerId }, color, count }))
}

export function warbandGroupsAtSites(
    state: HydratedOathGameState,
    siteIds: readonly string[],
    colors: readonly Color[]
): WarbandGroup[] {
    const groups: WarbandGroup[] = []
    for (const siteId of siteIds) {
        const onSite = warbandsAt(state, siteId)
        for (const color of colors) {
            const count = countOf(onSite, color)
            if (count > 0) groups.push({ at: { kind: 'site', siteId }, color, count })
        }
    }
    return groups
}

export function warbandsOnBoardOf(state: HydratedOathGameState, playerId: string): number {
    return totalWarbands(state.getPlayerState(playerId).warbandsOnBoard)
}

/** R-10.13 — the caller removes the warband. */
export function killWarbands(state: HydratedOathGameState, color: Color, count: number) {
    if (count <= 0) return

    const bank = state.getPlayerState(state.warbandOwnerOf(color)).warbandsInPersonalBank
    adjustCount(bank, color, count)
}

export function removeWarbandsFrom(
    state: HydratedOathGameState,
    at: WarbandLocation,
    color: Color,
    count: number
) {
    if (count <= 0) return

    const counts =
        at.kind === 'site'
            ? (state.warbandsBySite[at.siteId] ??= {})
            : state.getPlayerState(at.playerId).warbandsOnBoard

    const available = countOf(counts, color)
    if (available < count) {
        const where = at.kind === 'site' ? at.siteId : `${at.playerId}'s board`
        throw Error(`Cannot take ${count} ${color} from ${where}: only ${available} there`)
    }
    counts[color] = available - count
}

export function addWarbandsToBoard(
    state: HydratedOathGameState,
    playerId: string,
    color: Color,
    count: number
) {
    if (count <= 0) return
    const board = state.getPlayerState(playerId).warbandsOnBoard
    adjustCount(board, color, count)
}

export function addWarbandsToSite(
    state: HydratedOathGameState,
    siteId: string,
    color: Color,
    count: number
) {
    if (count <= 0) return
    const counts = (state.warbandsBySite[siteId] ??= {})
    adjustCount(counts, color, count)
}

export function addWarbandsToCard(
    state: HydratedOathGameState,
    cardId: string,
    color: Color,
    count: number
) {
    if (count <= 0) return
    const onCards = state.warbandsOnCards
    const counts = (onCards[cardId] ??= {})
    adjustCount(counts, color, count)
}

export function removeWarbandsFromCard(
    state: HydratedOathGameState,
    cardId: string,
    color: Color,
    count: number
) {
    if (count <= 0) return
    const counts = state.warbandsOnCard(cardId)
    const available = countOf(counts, color)
    if (available < count) {
        throw Error(`Cannot take ${count} ${color} from ${cardId}: only ${available} on it`)
    }
    counts[color] = available - count
}

/** R-10.13 — a card cannot carry warbands out of play, so they return to their banks as it leaves. */
export function returnWarbandsOnCardToBanks(state: HydratedOathGameState, cardId: string) {
    for (const [color, count] of warbandEntries(state.warbandsOnCard(cardId))) {
        removeWarbandsFromCard(state, cardId, color, count)
        killWarbands(state, color, count)
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
    return `${group.color} at ${where}`
}

/** R-5.5.6, R-5.5.7.I — site warbands go to their colour's board, the Empire's to the Chancellor. */
export function moveForceToBoards(state: HydratedOathGameState, force: readonly WarbandGroup[]) {
    for (const group of force) {
        if (group.at.kind !== 'site') {
            continue
        }
        removeWarbandsFrom(state, group.at, group.color, group.count)
        addWarbandsToBoard(state, state.warbandOwnerOf(group.color), group.color, group.count)
    }
}

/** R-10.13, R-5.2.2 */
export function warbandsInBankFor(state: HydratedOathGameState, color: Color): number {
    return countOf(state.getPlayerState(state.warbandOwnerOf(color)).warbandsInPersonalBank, color)
}

/** R-9.3 — "as many as possible": may return fewer than asked. */
export function takeWarbandsFromBank(
    state: HydratedOathGameState,
    color: Color,
    count: number
): number {
    if (count <= 0) return 0

    const available = warbandsInBankFor(state, color)
    const taken = Math.min(count, available)
    if (taken === 0) return 0

    const bank = state.getPlayerState(state.warbandOwnerOf(color)).warbandsInPersonalBank
    adjustCount(bank, color, -taken)
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
