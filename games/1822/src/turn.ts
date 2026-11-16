import { actsFor, nextOperatingCompany } from '@tabletop/18xx'
import type { HydratedState1822 } from './state.js'

/** The company laying track now, if the player directs it. */
export function trackCompany1822(state: HydratedState1822, playerId: string): string | undefined {
    const companyId = state.trackStep?.companyId
    return state.machineState === 'LayingTrack' &&
        companyId &&
        nextOperatingCompany(state) === companyId &&
        actsFor(state, playerId, companyId)
        ? companyId
        : undefined
}
