import { StopRights, stopRightsPurchase } from '@tabletop/18xx'
import { MesabiAccess } from './mesabiAccess.js'
import { MesabiPrivateId } from './privates.js'
import type { HydratedState1850 } from './state.js'
import { TrackRules1850 } from './track.js'

// $80, half to the company owning the open private; buying one uses a yellow tile lay (§6.5.1, §15.2).
export const MesabiRights = new StopRights({
    access: MesabiAccess,
    privateCompanyId: MesabiPrivateId,
    price: 80,
    track: TrackRules1850
})

export const MesabiPurchase = stopRightsPurchase<HydratedState1850>(MesabiRights, (state) => {
    state.mesabiBought = true
})
