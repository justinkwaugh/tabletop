import { HydratedOathGameState } from '../model/gameState.js'
import type { Region } from '../model/oathEnums.js'
import { categoryAt } from './sitePowers.js'
import { sitesWithTargets, targetedSiteIds } from './campaignSite.js'
import { areEnemies, isImperialPlayer, rulersOfSite, rulesSite } from './rule.js'
import { pawnSiteId } from './pawn.js'
import type { CampaignParties } from './campaign.js'
import {
    powerScopeOf,
    reasonPersistentForbidsSecretCost,
    type ScopedParties
} from './persistent.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/**
 * R-11.7 — leaving a Shrouded Wood an enemy rules, that ruler chooses where the pawn goes, the
 * Chancellor when the Empire rules it; the bandits choose nothing. A banish is judged in its
 * Campaign's scope (R-5.5.1.a-H2).
 */
export function shroudedWoodChooser(
    state: HydratedOathGameState,
    travelerId: string
): string | undefined {
    const here = pawnSiteId(state, travelerId)
    if (categoryAt(state, here) !== 'shroudedWood') return undefined
    const scope = powerScopeOf(state)
    const enemies = rulersOfSite(state, here, scope).filter((id) =>
        areEnemies(state, id, travelerId, scope)
    )
    if (enemies.length === 0) return undefined
    return enemies.some((id) => isImperialPlayer(state, id, scope))
        ? state.chancellorId()
        : enemies[0]
}

/**
 * R-11.12, R-11.13 — the secrets a Travel flips facedown, as the action records them: `true` one, as
 * it always has, and `2` two (R-11.13-H2, revision 20). `false` or absent, none.
 */
export type TravelFlip = boolean | 2

/** How many secrets a recorded flip turns facedown. */
export function secretsFlipped(flip: TravelFlip | undefined): number {
    if (flip === 2) return 2
    return flip === true ? 1 : 0
}

/** A count as the action records it: one is `true`, as it always was. */
export function travelFlipOf(count: number): TravelFlip {
    if (count === 2) return 2
    return count === 1
}

// R-11.3 to R-11.13, R-9.2 — a named ignore beats a must; the player's secret flip rides the action.
export interface SiteTravelTerms {
    cost: number
    /** R-7.6.2 */
    spendsNoSupply: boolean
    ignoresNarrowPass: boolean
    ignoresHiddenPlace: boolean
    notes: string[]
}

/** R-11.3, R-11.6, R-11.7, R-11.12, R-11.13-H2 — `flips`: the secrets the Travel flips facedown. */
export function siteTravelTerms(
    state: HydratedOathGameState,
    fromSiteId: string,
    toSiteId: string,
    base: number,
    flips: number
): SiteTravelTerms {
    const from = categoryAt(state, fromSiteId)
    const to = categoryAt(state, toSiteId)
    const terms: SiteTravelTerms = {
        cost: base,
        spendsNoSupply: false,
        ignoresNarrowPass: false,
        ignoresHiddenPlace: false,
        notes: []
    }
    if (from === 'coast' && to === 'coast') {
        terms.cost = 1
        terms.ignoresNarrowPass = true
        terms.notes.push('Coast: 1 Supply to another Coast, ignoring the Narrow Pass')
    }
    if (from === 'charmingValley') {
        terms.cost += 1
        terms.notes.push('Charming Valley: one more Supply to leave')
    }
    if (from === 'shroudedWood') {
        terms.cost = 2
        terms.ignoresNarrowPass = true
        terms.ignoresHiddenPlace = true
        terms.notes.push(
            'Shrouded Wood: 2 Supply to leave, ignoring the Narrow Pass and The Hidden Place'
        )
    }
    if (from === 'buriedGiant' && buriedGiantFlips(state, toSiteId, flips) > 0) {
        terms.spendsNoSupply = true
        terms.ignoresNarrowPass = true
        terms.notes.push(
            'Buried Giant: a secret flipped facedown, no Supply spent, ignoring the Narrow Pass'
        )
    }
    return terms
}

/**
 * R-11.13-H2 (revision 20) — each site's power takes its own flip: travelling to The Hidden Place,
 * its flip is the first, and only a second is the Buried Giant's. Before it one flip served both.
 */
function buriedGiantFlips(state: HydratedOathGameState, toSiteId: string, flips: number): number {
    const eachPowerFlips = isAtLeastOathRevision(state, OathRevision.EngineFixes16)
    return eachPowerFlips && categoryAt(state, toSiteId) === 'hiddenPlace' ? flips - 1 : flips
}

/**
 * R-11.12, R-11.13 — how many secrets the sites of a Travel may take: one for leaving the Buried
 * Giant, one for entering The Hidden Place. From revision 20 (R-11.13-H2) each counts; before it a
 * Travel flips one at most, which served both.
 */
export function flipsOfferedForTravel(
    state: HydratedOathGameState,
    fromSiteId: string,
    toSiteId: string
): number {
    const giant = categoryAt(state, fromSiteId) === 'buriedGiant' ? 1 : 0
    const hidden = categoryAt(state, toSiteId) === 'hiddenPlace' ? 1 : 0
    return isAtLeastOathRevision(state, OathRevision.EngineFixes16)
        ? giant + hidden
        : Math.max(giant, hidden)
}

export function narrowPassIn(state: HydratedOathGameState, region: Region): string | undefined {
    return state
        .allSiteIds()
        .find(
            (siteId) =>
                state.regionOf(siteId) === region && categoryAt(state, siteId) === 'narrowPass'
        )
}

/**
 * `offered`: how many flips the sites ask for or allow; `flips`: how many are made, each a different
 * faceup secret (R-7.1.2: a facedown secret pays nothing). `secretsPaid`: faceup secrets a power's
 * cost takes first, as Wild Allies' does before its Campaign is declared. `parties`: the Campaign a
 * secret is flipped to target in.
 */
export function reasonFlipInvalid(
    state: HydratedOathGameState,
    playerId: string,
    offered: number,
    flips: number,
    secretsPaid = 0,
    parties?: ScopedParties
): string | undefined {
    if (flips === 0) return undefined
    if (offered === 0) return 'no site here asks for a secret to be flipped'
    if (flips > offered) return 'one secret at most is flipped here'
    const faceup = state.getPlayerState(playerId).secrets - secretsPaid
    if (faceup < 1) return 'you have no faceup secret to flip'
    if (faceup < flips) return `flipping ${flips} secrets takes ${flips} faceup secrets: you have ${faceup}`
    // Spell Breaker — its Q&A names the secrets flipped to travel or to target, so it bars every flip.
    return reasonPersistentForbidsSecretCost(state, playerId, parties)
}

/** R-11.8, R-11.13 */
export function reasonSitesForbidTravel(
    state: HydratedOathGameState,
    playerId: string,
    fromSiteId: string,
    toSiteId: string,
    flips: number
): string | undefined {
    const terms = siteTravelTerms(state, fromSiteId, toSiteId, 0, flips)
    const offered = flipsOfferedForTravel(state, fromSiteId, toSiteId)
    const flip = reasonFlipInvalid(state, playerId, offered, flips)
    if (flip) return flip
    if (categoryAt(state, toSiteId) === 'hiddenPlace' && !terms.ignoresHiddenPlace && flips === 0) {
        return 'The Hidden Place: you cannot travel here unless you flip a secret facedown'
    }
    const toRegion = state.regionOf(toSiteId)
    if (state.regionOf(fromSiteId) !== toRegion && !terms.ignoresNarrowPass) {
        const pass = narrowPassIn(state, toRegion)
        if (pass && pass !== toSiteId) {
            return `Narrow Pass: travelling into the ${toRegion}, you must travel to ${pass}`
        }
    }
    return undefined
}

export function flipOfferedForTravel(
    state: HydratedOathGameState,
    fromSiteId: string,
    toSiteId: string
): 'demanded' | 'offered' | undefined {
    if (
        categoryAt(state, toSiteId) === 'hiddenPlace' &&
        categoryAt(state, fromSiteId) !== 'shroudedWood'
    )
        return 'demanded'
    if (categoryAt(state, fromSiteId) === 'buriedGiant') return 'offered'
    return undefined
}

/** R-11.8, R-11.13 — `secretsPaid` as for `reasonFlipInvalid`. */
export function reasonSitesForbidTargets(
    state: HydratedOathGameState,
    parties: CampaignParties,
    flipSecret: boolean,
    secretsPaid = 0
): string | undefined {
    const sites = targetedSiteIds(parties)
    const hidden = targetsNeedFlip(state, parties)
    const flip = reasonFlipInvalid(
        state,
        parties.attackerPlayerId,
        hidden ? 1 : 0,
        flipSecret ? 1 : 0,
        secretsPaid,
        parties
    )
    if (flip) return flip
    if (hidden && !flipSecret)
        return 'The Hidden Place: you cannot declare targets here unless you flip a secret facedown'
    const myRegion = state.regionOf(parties.attackerSiteId)
    // R-5.5.1.a-H2 — "unless you rule it", in the Campaign's scope.
    const scope = powerScopeOf(state, parties)
    for (const region of new Set(sites.map((siteId) => state.regionOf(siteId)))) {
        if (region === myRegion) continue
        const pass = narrowPassIn(state, region)
        if (
            !pass ||
            sites.includes(pass) ||
            rulesSite(state, parties.attackerPlayerId, pass, scope)
        )
            continue
        return `Narrow Pass: targeting the ${region} from another region, you must target ${pass} unless you rule it`
    }
    return undefined
}

/** R-11.12, R-11.13 — `count` faceup secrets, each its own (R-11.13-H2). */
export function flipSecretFacedown(state: HydratedOathGameState, playerId: string, count = 1): void {
    const player = state.getPlayerState(playerId)
    player.secrets -= count
    player.secretsFacedown += count
}

/** The Hidden Place */
export function targetsNeedFlip(state: HydratedOathGameState, parties: CampaignParties): boolean {
    return sitesWithTargets(state, parties).some(
        (siteId) => categoryAt(state, siteId) === 'hiddenPlace'
    )
}
