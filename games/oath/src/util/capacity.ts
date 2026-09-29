import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { siteCapacity } from '../data/cardRegistry.js'

/** R-2.8.1 — rewrites its site's capacity when played. */
export const SALT_THE_EARTH = 'denizen.discord.salt-the-earth'

/** R-2.8.1 */
export function effectiveSiteCapacity(state: HydratedOathGameState, siteId: string): number {
    const override = state.siteCapacityOverrides[siteId]
    if (override !== undefined) return override
    const siteCardId = state.siteCardAt(siteId)
    assertExists(siteCardId, `${siteId} has no faceup site card`)
    const capacity = siteCapacity(siteCardId)
    assertExists(capacity, `${siteCardId} has no printed capacity`)
    return capacity
}
