import { assert, assertExists, type Color } from '@tabletop/common'
import { isLockedFor } from '../util/locked.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, Region, Suit } from '../model/oathEnums.js'
import type { WarbandGroup } from '../model/campaign.js'
import type { PileDeposit } from '../model/hidden.js'
import { discardCards } from '../util/discard.js'
import { discardFromPlayInChosenOrder } from '../util/orderedDiscard.js'
import {
    addWarbandsToBoard,
    addWarbandsToSite,
    killWarbands,
    removeWarbandsFrom,
    boardColorsOwnFirst,
    boardWarbandGroups
} from '../util/force.js'
import { suitOf } from '../data/cardRegistry.js'
import { warbandsAt, warbandsFreeToLeave } from '../util/rule.js'
import { ruledFaceupCardIds, siteHolding } from '../util/access.js'
import { burnFromBanner } from '../util/seize.js'
import { countOf, adjustCount, warbandEntries } from '../util/warbands.js'
import type { WarbandCounts } from '../model/warbandCounts.js'
import { playersAt } from '../util/questions.js'
import { pawnSiteId, regionOfPawn } from '../util/pawn.js'

export { gainFavorFromBank, takeFavorFromPlayer } from '../util/favor.js'
export { pawnSiteId, regionOfPawn } from '../util/pawn.js'
export { gainWarbandsToBoard } from '../util/force.js'
export { denizensOnMap } from '../util/access.js'
export { rollDefenseShields } from '../data/dice.js'

export function cardSuitIsOneOf(cardId: string, suits: readonly Suit[]): boolean {
    const suit = suitOf(cardId)
    return suit !== undefined && suits.includes(suit)
}

export function siteHasCardOfSuit(
    state: HydratedOathGameState,
    siteId: string,
    suit: Suit
): boolean {
    return state.denizensAt(siteId).some((id) => suitOf(id) === suit)
}

export function faceupSitesWithCardOfSuit(state: HydratedOathGameState, suit: Suit): string[] {
    return state.faceupSiteIds().filter((siteId) => siteHasCardOfSuit(state, siteId, suit))
}

export function hasFaceupAdviserOfSuit(
    state: HydratedOathGameState,
    playerId: string,
    suit: Suit
): boolean {
    return state
        .getPlayerState(playerId)
        .faceupAdviserIds()
        .some((cardId) => suitOf(cardId) === suit)
}

/** R-10.10 — secrets are not component-limited (R-9.3), so this never falls short. */
export function gainSecrets(state: HydratedOathGameState, playerId: string, count: number): number {
    state.getPlayerState(playerId).secrets += count
    return count
}

/** R-10.26 — "you cannot take their last [secret]" is `floor: 1`. */
export function takeSecretsFromPlayer(
    state: HydratedOathGameState,
    takerId: string,
    fromId: string,
    wanted: number,
    floor = 0
): number {
    const from = state.getPlayerState(fromId)
    // R-7.1.2.a — only faceup secrets can be taken, but a facedown one still keeps the floor.
    const taken = Math.max(
        0,
        Math.min(wanted, from.secrets, from.secrets + from.secretsFacedown - floor)
    )
    from.secrets -= taken
    state.getPlayerState(takerId).secrets += taken
    return taken
}

/** R-10.4 — faceup secrets only. */
export function burnSecretsFromPlayer(
    state: HydratedOathGameState,
    playerId: string,
    count: number
): number {
    const player = state.getPlayerState(playerId)
    const burned = Math.max(0, Math.min(count, player.secrets))
    player.secrets -= burned
    return burned
}

/** R-9.3 — unlimited. */
export function placeSecretsOnDarkestSecret(state: HydratedOathGameState, count: number): number {
    state.banners[Banner.DarkestSecret].value += count
    return count
}

/** R-2.5.3 — the Darkest Secret never drops below its floor of one secret. */
export function burnSecretsFromDarkestSecret(state: HydratedOathGameState, count: number): number {
    return burnFromBanner(state, Banner.DarkestSecret, count)
}

/** R-10.13 — their own colour first. */
export function killWarbandsOnBoard(
    state: HydratedOathGameState,
    ownerId: string,
    count: number
): { color?: Color; killed: number } {
    const owner = state.getPlayerState(ownerId)
    const color = boardColorsOwnFirst(state, ownerId).find(
        (c) => countOf(owner.warbandsOnBoard, c) > 0
    )
    if (!color) return { killed: 0 }
    const killed = Math.min(count, countOf(owner.warbandsOnBoard, color))
    removeWarbandsFrom(state, { kind: 'board', playerId: ownerId }, color, killed)
    killWarbands(state, color, killed)
    return { color, killed }
}

/** R-10.13 — largest colour group first. */
export function killWarbandsAtSite(
    state: HydratedOathGameState,
    siteId: string,
    count: number
): WarbandCounts {
    const killed: WarbandCounts = {}
    let left = count
    const present = { ...warbandsAt(state, siteId) }
    while (left > 0) {
        const [color, n] = warbandEntries(present).sort((a, b) => b[1] - a[1])[0] ?? []
        if (!color || !n) break
        const take = Math.min(left, n)
        removeWarbandsFrom(state, { kind: 'site', siteId }, color, take)
        killWarbands(state, color, take)
        adjustCount(killed, color, take)
        present[color] = n - take
        if (present[color] === 0) delete present[color]
        left -= take
    }
    return killed
}

/** R-10.5 — the caller detaches the card from its zone. */
export function discardAdviser(
    state: HydratedOathGameState,
    actingPlayerId: string,
    ownerId: string,
    cardId: string,
    fromRegion: Region
): PileDeposit[] {
    const owner = state.getPlayerState(ownerId)
    if (!owner.hasAdviser(cardId)) return []
    owner.removeAdviser(cardId)
    return discardCards(state, actingPlayerId, [cardId], fromRegion)
}

/** R-10.15 — honours R-2.8.1's capacity. */
export function moveAdviserToSite(
    state: HydratedOathGameState,
    ownerId: string,
    cardId: string,
    siteId: string
): void {
    const owner = state.getPlayerState(ownerId)
    assert(owner.hasAdviser(cardId), `${cardId} is one of ${ownerId}'s advisers`)
    assert(siteHasRoom(state, siteId), `${siteId} has room for ${cardId}`)
    owner.removeAdviser(cardId)
    state.denizensBySite[siteId] = [...state.denizensAt(siteId), cardId]
}

/** R-2.8.1 */
export function siteHasRoom(state: HydratedOathGameState, siteId: string): boolean {
    if (!state.isSiteFaceup(siteId)) return false
    return state.denizensAt(siteId).length < effectiveSiteCapacity(state, siteId)
}

export function otherPlayersAtYourSite(state: HydratedOathGameState, playerId: string): string[] {
    return playersAt(state, pawnSiteId(state, playerId)).filter((id) => id !== playerId)
}

export function denizensAtYourSite(state: HydratedOathGameState, playerId: string): string[] {
    return state.denizensAt(pawnSiteId(state, playerId))
}

export function faceupSitesInYourRegion(state: HydratedOathGameState, playerId: string): string[] {
    const region = regionOfPawn(state, playerId)
    return state.faceupSiteIds().filter((s) => state.regionOf(s) === region)
}

/** R-10.5, R-7.2.2 — locked cards stay, and R-7.1.3 resolves as much as possible; each card leaves from its site's region, in the discarder's order. */
export function discardDenizensAtSites(
    state: HydratedOathGameState,
    actingPlayerId: string,
    siteIds: readonly string[],
    matches: (cardId: string) => boolean,
    sourceCardId: string
): DiscardedDenizens {
    const discarded = siteIds.flatMap((siteId) =>
        state
            .denizensAt(siteId)
            .filter((id) => matches(id) && !isLockedFor(state, actingPlayerId, id))
    )
    return {
        discarded,
        pileDeposits: discardFromPlayInChosenOrder(state, actingPlayerId, discarded, sourceCardId)
    }
}

export interface DiscardedDenizens {
    discarded: string[]
    pileDeposits: PileDeposit[]
}

/** R-7.1.3 */
export function favorObtainableFromPicks(
    state: HydratedOathGameState,
    suits: readonly Suit[]
): number {
    const wanted = new Map<Suit, number>()
    for (const suit of suits) wanted.set(suit, (wanted.get(suit) ?? 0) + 1)
    let obtainable = 0
    for (const [suit, count] of wanted) {
        obtainable += Math.min(count, state.favorBank[suit])
    }
    return obtainable
}

/** R-10.21 */
export function ruledCardsOfSuit(
    state: HydratedOathGameState,
    playerId: string,
    suit: Suit
): string[] {
    return ruledFaceupCardIds(state, playerId).filter((id) => suitOf(id) === suit)
}

export function moveFavorBetweenBanks(
    state: HydratedOathGameState,
    from: Suit,
    to: Suit,
    wanted: number
): number {
    const moved = Math.max(0, Math.min(wanted, state.favorBank[from]))
    state.favorBank[from] -= moved
    state.favorBank[to] += moved
    return moved
}

/** R-10.25 — a 1:1 swap leaves capacity unchanged; the caller's domain refuses a locked target (R-7.2.2). */
export function swapPlayedCardWithSiteCard(
    state: HydratedOathGameState,
    playerId: string,
    playedCardId: string,
    siteCardId: string
): void {
    const targetSite = siteHolding(state, siteCardId)
    assertExists(targetSite, `${siteCardId} is a denizen at a site`)
    const player = state.getPlayerState(playerId)
    const playedAtSite = siteHolding(state, playedCardId)
    if (playedAtSite) {
        state.denizensBySite[playedAtSite] = state.denizensBySite[playedAtSite].map((id) =>
            id === playedCardId ? siteCardId : id
        )
    } else {
        assert(
            player.isFaceupAdviser(playedCardId),
            `${playedCardId} is at a site or one of ${playerId}'s faceup advisers`
        )
        player.replaceAdviser(playedCardId, { cardId: siteCardId, faceUp: true })
    }
    state.denizensBySite[targetSite] = state.denizensBySite[targetSite].map((id) =>
        id === siteCardId ? playedCardId : id
    )
}

export function moveWarbandsBoardToSite(
    state: HydratedOathGameState,
    playerId: string,
    color: Color,
    siteId: string,
    count: number
): number {
    const board = state.getPlayerState(playerId).warbandsOnBoard
    const moved = Math.max(0, Math.min(count, countOf(board, color)))
    if (moved === 0) return 0
    removeWarbandsFrom(state, { kind: 'board', playerId }, color, moved)
    addWarbandsToSite(state, siteId, color, moved)
    return moved
}

/** R-6.5 — never the last warband at the site, which keeps rule of the site stable. */
export function moveWarbandsSiteToBoard(
    state: HydratedOathGameState,
    playerId: string,
    color: Color,
    siteId: string,
    count: number
): number {
    const moved = Math.max(0, Math.min(count, warbandsFreeToLeave(state, playerId, siteId, color)))
    if (moved === 0) return 0
    removeWarbandsFrom(state, { kind: 'site', siteId }, color, moved)
    addWarbandsToBoard(state, playerId, color, moved)
    return moved
}

/** R-10.13 — as many as are there. */
export function killWarbandGroup(state: HydratedOathGameState, group: WarbandGroup): number {
    const present =
        group.at.kind === 'board'
            ? countOf(state.getPlayerState(group.at.playerId).warbandsOnBoard, group.color)
            : countOf(warbandsAt(state, group.at.siteId), group.color)
    const killed = Math.max(0, Math.min(group.count, present))
    if (killed === 0) return 0
    removeWarbandsFrom(state, group.at, group.color, killed)
    killWarbands(state, group.color, killed)
    return killed
}

/** Terror Spells' "in your region": the boards of pawns there count too. */
export function warbandGroupsInRegion(
    state: HydratedOathGameState,
    playerId: string
): WarbandGroup[] {
    const region = regionOfPawn(state, playerId)
    const groups: WarbandGroup[] = []
    for (const siteId of state.allSiteIds()) {
        if (state.regionOf(siteId) !== region) continue
        for (const [color, count] of warbandEntries(warbandsAt(state, siteId))) {
            if (count > 0) groups.push({ at: { kind: 'site', siteId }, color, count })
        }
    }
    for (const p of state.players) {
        if (regionOfPawn(state, p.playerId) !== region) continue
        groups.push(...boardWarbandGroups(state, p.playerId))
    }
    return groups
}
