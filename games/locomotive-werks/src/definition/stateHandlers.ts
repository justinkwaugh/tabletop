import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { AdjustingMarketStateHandler } from '../stateHandlers/adjustingMarket.js'
import { DevelopingStateHandler } from '../stateHandlers/developing.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { ExpandingCapacityStateHandler } from '../stateHandlers/expandingCapacity.js'
import { PayingTaxesStateHandler } from '../stateHandlers/payingTaxes.js'
import { ShippingStateHandler } from '../stateHandlers/shipping.js'

export const LwStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedLwGameState>
> = {
    [MachineState.Developing]: new DevelopingStateHandler(),
    [MachineState.ExpandingCapacity]: new ExpandingCapacityStateHandler(),
    [MachineState.Shipping]: new ShippingStateHandler(),
    [MachineState.PayingTaxes]: new PayingTaxesStateHandler(),
    [MachineState.AdjustingMarket]: new AdjustingMarketStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
