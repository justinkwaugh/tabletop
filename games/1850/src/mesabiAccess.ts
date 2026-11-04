import { StopAccess } from '@tabletop/18xx'
import { MesabiLocationId } from './map.js'
import { requireState1850 } from './state.js'

// Only companies holding one of the four Mesabi tokens may run to or through the Range, for routes
// and for the runs that reach new track and cities (§6.5.1, §8.1c).
export const MesabiAccess = new StopAccess({
    locationId: MesabiLocationId,
    tokens: 4,
    holders: (state) => requireState1850(state).mesabiRights
})
