import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { siteCapacity } from '../data/cardRegistry.js'
import type { PlayMapChanges } from '../powers/registry.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/** R-2.8.1 — rewrites its site's capacity when played. */
export const SALT_THE_EARTH = 'denizen.discord.salt-the-earth'

/** Salt the Earth — "This site's capacity is now 1." */
export const SALTED_SITE_CAPACITY = 1

/**
 * R-2.8.1, R-7-H1 — from revision 31 Salt the Earth's capacity holds exactly while the card is at the site, by
 * whatever route it leaves.
 */
export function effectiveSiteCapacity(state: HydratedOathGameState, siteId: string): number {
    const override = state.siteCapacityOverrides[siteId]
    if (override !== undefined && saltedWhileThere(state, siteId)) return override
    return printedSiteCapacity(state, siteId)
}

function saltedWhileThere(state: HydratedOathGameState, siteId: string): boolean {
    return (
        !isAtLeastOathRevision(state, OathRevision.EngineFixes26) ||
        state.denizensAt(siteId).includes(SALT_THE_EARTH)
    )
}

/** R-2.8.1 — the capacity printed on the site card. */
export function printedSiteCapacity(state: HydratedOathGameState, siteId: string): number {
    const siteCardId = state.siteCardAt(siteId)
    assertExists(siteCardId, `${siteId} has no faceup site card`)
    const capacity = siteCapacity(siteCardId)
    assertExists(capacity, `${siteCardId} has no printed capacity`)
    return capacity
}

/**
 * R-2.8.1 — a site's capacity once one play has landed (`mapChanges`, from `playMapChanges`), read from the state
 * before it: Salt the Earth played to the site makes it 1.
 */
export function siteCapacityAfterPlay(
    state: HydratedOathGameState,
    siteId: string,
    mapChanges: PlayMapChanges | undefined
): number {
    const salted = mapChanges?.siteId === siteId && mapChanges.arriving.includes(SALT_THE_EARTH)
    return salted ? SALTED_SITE_CAPACITY : effectiveSiteCapacity(state, siteId)
}
