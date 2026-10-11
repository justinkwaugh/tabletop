import { IMPERIAL_WARBANDS, type WarbandCounts, type WarbandOwner } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { relicPersistentsHeldBy } from './heldPersistents.js'
import { totalWarbands, countOf } from './warbands.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/** R-10.21 — any warband a player rules with rules a faceup site. */

/** R-5.5.1.a */
export interface ImperialScope {
    nonImperialPlayerIds?: readonly string[]
}

export function warbandsAt(state: HydratedOathGameState, siteId: string): WarbandCounts {
    return state.warbandsBySite[siteId] ?? {}
}

export function totalWarbandsAt(state: HydratedOathGameState, siteId: string): number {
    return totalWarbands(warbandsAt(state, siteId))
}

/** R-10.12, R-6.6.3 — R-5.5.1.a suspends only a Citizen's status. */
export function isImperialPlayer(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): boolean {
    const player = state.getPlayerState(playerId)
    if (player.status === PlayerStatus.Chancellor) return true
    if (player.status !== PlayerStatus.Citizen) return false
    return !scope?.nonImperialPlayerIds?.includes(playerId)
}

/** R-1.8, R-1.9 — the Chancellor's warbands are the Empire's; every other player's are their own. */
export function ownWarbandOwner(state: HydratedOathGameState, playerId: string): WarbandOwner {
    const player = state.getPlayerState(playerId)
    return player.status === PlayerStatus.Chancellor ? IMPERIAL_WARBANDS : player.playerId
}

/** R-10.21 plus R-6.6.3: an Imperial player also rules with the Empire's warbands. */
export function rulingWarbandOwners(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): WarbandOwner[] {
    const own = ownWarbandOwner(state, playerId)
    if (own === IMPERIAL_WARBANDS || !isImperialPlayer(state, playerId, scope)) return [own]
    return [own, IMPERIAL_WARBANDS]
}

function rulesByWarbands(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    scope?: ImperialScope
): boolean {
    const onSite = warbandsAt(state, siteId)
    return rulingWarbandOwners(state, playerId, scope).some((owner) => countOf(onSite, owner) > 0)
}

export function rulesSite(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    scope?: ImperialScope
): boolean {
    if (!state.isSiteFaceup(siteId)) return false
    return (
        rulesByWarbands(state, playerId, siteId, scope) ||
        banditsHoldSiteFor(state, playerId, siteId, scope)
    )
}

/** R-10.7 — two Imperial players are the only pair who are not; R-5.5.1.a's scope suspends a Citizen. */
export function areEnemies(
    state: HydratedOathGameState,
    a: string,
    b: string,
    scope?: ImperialScope
): boolean {
    if (a === b) return false
    return !(isImperialPlayer(state, a, scope) && isImperialPlayer(state, b, scope))
}

/** R-7.6.5 — the Bandit Crown: "you treat bandits as your warbands". */
export function actsAsIfBanditsAreWarbands(
    state: HydratedOathGameState,
    playerId: string
): boolean {
    const player = state.getPlayerState(playerId)
    if (player.relicIds.length === 0) return false
    return relicPersistentsHeldBy(state, player).some(({ hooks }) => hooks.banditsAreHolderWarbands)
}

/** R-7.6.5 — "except at sites ruled by enemies" reads the enemies' own warbands. */
export function banditsServe(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    scope?: ImperialScope
): boolean {
    if (!state.isSiteFaceup(siteId)) return false
    if (!actsAsIfBanditsAreWarbands(state, playerId)) return false
    return !state.players.some(
        (other) =>
            areEnemies(state, playerId, other.playerId, scope) &&
            rulesByWarbands(state, other.playerId, siteId, scope)
    )
}

/**
 * R-7.6.5 with R-6.6.3 — the Crown's Q&A: for the Chancellor or a Citizen "your warbands" are
 * the Empire's, so the bandits that serve an Imperial holder are Imperial warbands. R-X.4: from
 * revision 5; before it they served the holder alone.
 */
function banditsServeTheEmpire(
    state: HydratedOathGameState,
    siteId: string,
    scope?: ImperialScope
): boolean {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes2)) return false
    return state.players.some(
        (holder) =>
            isImperialPlayer(state, holder.playerId, scope) &&
            banditsServe(state, holder.playerId, siteId, scope)
    )
}

/** R-7.6.5 — the bandits hold the site for its holder, and for every Imperial player when they are the Empire's. */
export function banditsHoldSiteFor(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    scope?: ImperialScope
): boolean {
    if (banditsServe(state, playerId, siteId, scope)) return true
    return isImperialPlayer(state, playerId, scope) && banditsServeTheEmpire(state, siteId, scope)
}

/** R-6.5 — the last warband stays to hold the site, unless R-7.6.5's bandits hold it. */
export function warbandsFreeToLeave(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    owner: WarbandOwner
): number {
    const atSite = countOf(warbandsAt(state, siteId), owner)
    return banditsHoldSiteFor(state, playerId, siteId) ? atSite : Math.max(0, atSite - 1)
}

/** R-6.6.3 — a site the Empire's bandits hold has Imperial warbands. */
export function isImperialSite(
    state: HydratedOathGameState,
    siteId: string,
    scope?: ImperialScope
): boolean {
    if (!state.isSiteFaceup(siteId)) return false
    return (
        countOf(warbandsAt(state, siteId), IMPERIAL_WARBANDS) > 0 ||
        banditsServeTheEmpire(state, siteId, scope)
    )
}

/** R-6.6.3 — the bandits are `banditsRuleSite`'s. */
export function rulersOfSite(
    state: HydratedOathGameState,
    siteId: string,
    scope?: ImperialScope
): string[] {
    return state.players
        .filter((player) => rulesSite(state, player.playerId, siteId, scope))
        .map((player) => player.playerId)
}

/** R-5.5.2's "any sites they rule, anywhere on the map" is why this walks it all. */
export function sitesRuledBy(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): string[] {
    return state.allSiteIds().filter((siteId) => rulesSite(state, playerId, siteId, scope))
}

/** R-10.21 */
export function banditsRuleSite(state: HydratedOathGameState, siteId: string): boolean {
    if (!state.isSiteFaceup(siteId) || totalWarbandsAt(state, siteId) > 0) return false
    // R-7.6.5 — "you rule empty sites": the bandits there are the Crown holder's warbands.
    return !state.players.some((player) => actsAsIfBanditsAreWarbands(state, player.playerId))
}
