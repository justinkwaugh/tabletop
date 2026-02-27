import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedIndonesiaGameState } from '../model/gameState.js'

import { AcquisitionsStateHandler } from '../stateHandlers/acquisitions.js'
import { MergersStateHandler } from '../stateHandlers/mergers.js'
import { BiddingForTurnOrderStateHandler } from '../stateHandlers/biddingForTurnOrder.js'
import { NewEraStateHandler } from '../stateHandlers/newEra.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { ResearchAndDevelopmentStateHandler } from '../stateHandlers/researchAndDevelopment.js'
import { OperationsStateHandler } from '../stateHandlers/operations.js'
import { ShippingOperationsStateHandler } from '../stateHandlers/shippingOperations.js'
import { ProductionOperationsStateHandler } from '../stateHandlers/productionOperations.js'
import { CityGrowthStateHandler } from '../stateHandlers/cityGrowth.js'
// The mapping of machine states to their handlers for the Sample game, used by the game engine
export const IndonesiaStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedIndonesiaGameState>
> = {
    [MachineState.EndOfGame]: new EndOfGameStateHandler(),

    [MachineState.NewEra]: new NewEraStateHandler(),
    [MachineState.BiddingForTurnOrder]: new BiddingForTurnOrderStateHandler(),
    [MachineState.Mergers]: new MergersStateHandler(),
    [MachineState.Acquisitions]: new AcquisitionsStateHandler(),
    [MachineState.ResearchAndDevelopment]: new ResearchAndDevelopmentStateHandler(),
    [MachineState.Operations]: new OperationsStateHandler(),
    [MachineState.CityGrowth]: new CityGrowthStateHandler(),
    [MachineState.ShippingOperations]: new ShippingOperationsStateHandler(),
    [MachineState.ProductionOperations]: new ProductionOperationsStateHandler(),
}
