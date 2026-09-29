import type { Color } from '@tabletop/common'
import type { WarbandCounts } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { relicPersistentsHeldBy } from './heldPersistents.js'
import { totalWarbands, countOf } from './warbands.js'

/** R-10.21 — any warband of the colour rules a faceup site. */

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

/** R-10.21 plus R-6.6.3's purple; the Chancellor's own colour is already purple. */
export function rulingColorsOf(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): Color[] {
    const player = state.getPlayerState(playerId)

    const colors: Color[] = [player.color]
    if (isImperialPlayer(state, playerId, scope) && !colors.includes(IMPERIAL_COLOR)) {
        colors.push(IMPERIAL_COLOR)
    }
    return colors
}

function rulesByWarbands(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    scope?: ImperialScope
): boolean {
    const onSite = warbandsAt(state, siteId)
    return rulingColorsOf(state, playerId, scope).some((color) => countOf(onSite, color) > 0)
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
        banditsServe(state, playerId, siteId, scope)
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

function actsAsIfBanditsAreWarbands(state: HydratedOathGameState, playerId: string): boolean {
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

/** R-6.5 — the last warband stays to hold the site, unless R-7.6.5's bandits hold it. */
export function warbandsFreeToLeave(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    color: Color
): number {
    const atSite = countOf(warbandsAt(state, siteId), color)
    return banditsServe(state, playerId, siteId) ? atSite : Math.max(0, atSite - 1)
}

/** R-6.6.3 */
export function isImperialSite(state: HydratedOathGameState, siteId: string): boolean {
    return state.isSiteFaceup(siteId) && countOf(warbandsAt(state, siteId), IMPERIAL_COLOR) > 0
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
