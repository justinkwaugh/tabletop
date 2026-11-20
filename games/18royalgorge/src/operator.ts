import { actsFor, nextOperatingCompany } from '@tabletop/18xx'
import type { HydratedStateRoyalGorge } from './state.js'

/** The operating railroad, when the player acts for it. */
export function operatedBy(state: HydratedStateRoyalGorge, playerId: string): string | undefined {
    const companyId = nextOperatingCompany(state)
    return companyId && actsFor(state, playerId, companyId) ? companyId : undefined
}
