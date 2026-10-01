import { HydratedOathGameState } from '../model/gameState.js'
import type { Region } from '../model/oathEnums.js'
import { categoryAt } from './sitePowers.js'
import { attackingSiteOf, sitesWithTargets, targetedSiteIds } from './campaignSite.js'
import { areEnemies, isImperialPlayer, rulersOfSite, rulesSite } from './rule.js'
import { pawnSiteId } from './pawn.js'
import type { CampaignParties } from './campaign.js'
import { reasonPersistentForbidsSecretCost } from './persistent.js'

/**
 * R-11.7 — leaving a Shrouded Wood an enemy rules, that ruler chooses where the pawn goes, the
 * Chancellor when the Empire rules it; the bandits choose nothing.
 */
export function shroudedWoodChooser(
    state: HydratedOathGameState,
    travelerId: string
): string | undefined {
    const here = pawnSiteId(state, travelerId)
    if (categoryAt(state, here) !== 'shroudedWood') return undefined
    const enemies = rulersOfSite(state, here).filter((id) => areEnemies(state, id, travelerId))
    if (enemies.length === 0) return undefined
    return enemies.some((id) => isImperialPlayer(state, id)) ? state.chancellorId() : enemies[0]
}

// R-11.3 to R-11.13, R-9.2 — a named ignore beats a must; the player's secret flip rides the action.
export interface SiteTravelTerms {
    cost: number
    ignoresNarrowPass: boolean
    ignoresHiddenPlace: boolean
    notes: string[]
}

/** R-11.3, R-11.6, R-11.7, R-11.12 */
export function siteTravelTerms(
    state: HydratedOathGameState,
    fromSiteId: string,
    toSiteId: string,
    base: number,
    flipSecret: boolean
): SiteTravelTerms {
    const from = categoryAt(state, fromSiteId)
    const to = categoryAt(state, toSiteId)
    const terms: SiteTravelTerms = {
        cost: base,
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
    if (from === 'buriedGiant' && flipSecret) {
        terms.cost = 0
        terms.ignoresNarrowPass = true
        terms.notes.push(
            'Buried Giant: a secret flipped facedown, no Supply spent, ignoring the Narrow Pass'
        )
    }
    return terms
}

export function narrowPassIn(state: HydratedOathGameState, region: Region): string | undefined {
    return state
        .allSiteIds()
        .find(
            (siteId) =>
                state.regionOf(siteId) === region && categoryAt(state, siteId) === 'narrowPass'
        )
}

export function reasonFlipInvalid(
    state: HydratedOathGameState,
    playerId: string,
    offered: boolean,
    flipSecret: boolean
): string | undefined {
    if (!flipSecret) return undefined
    if (!offered) return 'no site here asks for a secret to be flipped'
    const player = state.getPlayerState(playerId)
    if (player.secrets < 1) return 'you have no faceup secret to flip'
    // Spell Breaker — its Q&A names the secret flipped to travel or to target.
    return reasonPersistentForbidsSecretCost(state, playerId)
}

/** R-11.8, R-11.13 */
export function reasonSitesForbidTravel(
    state: HydratedOathGameState,
    playerId: string,
    fromSiteId: string,
    toSiteId: string,
    flipSecret: boolean
): string | undefined {
    const terms = siteTravelTerms(state, fromSiteId, toSiteId, 0, flipSecret)
    const offered =
        categoryAt(state, fromSiteId) === 'buriedGiant' ||
        categoryAt(state, toSiteId) === 'hiddenPlace'
    const flip = reasonFlipInvalid(state, playerId, offered, flipSecret)
    if (flip) return flip
    if (categoryAt(state, toSiteId) === 'hiddenPlace' && !terms.ignoresHiddenPlace && !flipSecret) {
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

/** R-11.8, R-11.13 */
export function reasonSitesForbidTargets(
    state: HydratedOathGameState,
    parties: CampaignParties,
    flipSecret: boolean
): string | undefined {
    const sites = targetedSiteIds(parties)
    const hidden = targetsNeedFlip(state, parties)
    const flip = reasonFlipInvalid(state, parties.attackerPlayerId, hidden, flipSecret)
    if (flip) return flip
    if (hidden && !flipSecret)
        return 'The Hidden Place: you cannot declare targets here unless you flip a secret facedown'
    const myRegion = state.regionOf(attackingSiteOf(state, parties.attackerPlayerId))
    for (const region of new Set(sites.map((siteId) => state.regionOf(siteId)))) {
        if (region === myRegion) continue
        const pass = narrowPassIn(state, region)
        if (!pass || sites.includes(pass) || rulesSite(state, parties.attackerPlayerId, pass))
            continue
        return `Narrow Pass: targeting the ${region} from another region, you must target ${pass} unless you rule it`
    }
    return undefined
}

/** R-11.12, R-11.13 */
export function flipSecretFacedown(state: HydratedOathGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    player.secrets -= 1
    player.secretsFacedown += 1
}

/** The Hidden Place */
export function targetsNeedFlip(state: HydratedOathGameState, parties: CampaignParties): boolean {
    return sitesWithTargets(state, parties).some(
        (siteId) => categoryAt(state, siteId) === 'hiddenPlace'
    )
}
