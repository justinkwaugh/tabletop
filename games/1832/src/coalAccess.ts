import type { RevenueCenter } from '@tabletop/18xx'
import { requireEighteenThirtyTwoState } from './state.js'

export const CoalFieldsLocationId = 'O26'

/**
 * Only companies holding a WVCF token may run to or through the coal fields, for routes and for
 * the runs that reach new track and cities (§6.1, §6.5.2, §8.1c).
 */
export function coalFieldsOpen(state: object, companyId: string, center: RevenueCenter): boolean {
    return (
        center.locationId !== CoalFieldsLocationId ||
        requireEighteenThirtyTwoState(state).coalRights.includes(companyId)
    )
}
