import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedLwGameState, type LwProjectedState } from '../model/gameState.js'
import { HydratedAdjustMarket, isAdjustMarket } from '../actions/adjustMarket.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import { HydratedExpandCapacity, isExpandCapacity } from '../actions/expandCapacity.js'
import { HydratedPassDevelopment, isPassDevelopment } from '../actions/passDevelopment.js'
import { HydratedPayTaxes, isPayTaxes } from '../actions/payTaxes.js'
import { HydratedShip, isShip } from '../actions/ship.js'

export class LwHydrator implements GameHydrator<LwProjectedState, HydratedLwGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isDevelop(data):
                return new HydratedDevelop(data)
            case isPassDevelopment(data):
                return new HydratedPassDevelopment(data)
            case isExpandCapacity(data):
                return new HydratedExpandCapacity(data)
            case isShip(data):
                return new HydratedShip(data)
            case isPayTaxes(data):
                return new HydratedPayTaxes(data)
            case isAdjustMarket(data):
                return new HydratedAdjustMarket(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: LwProjectedState): HydratedLwGameState {
        return new HydratedLwGameState(state)
    }
}
