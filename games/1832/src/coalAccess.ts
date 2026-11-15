import { StopAccess } from '@tabletop/18xx'
import { requireEighteenThirtyTwoState } from './state.js'

export const CoalFieldsLocationId = 'O26'

// Only companies holding a WVCF token may run to or through the coal fields, for routes and for
// the runs that reach new track and cities (§6.1, §6.5.2, §8.1c).
export const CoalAccess = new StopAccess({
    locationId: CoalFieldsLocationId,
    tokens: 5,
    holders: (state) => requireEighteenThirtyTwoState(state).coalRights
})
