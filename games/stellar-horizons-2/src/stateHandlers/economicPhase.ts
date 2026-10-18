import type { TSchema } from 'typebox'
import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import {
    DrawEconomicTile,
    HydratedDrawEconomicTile,
    isDrawEconomicTile
} from '../actions/drawEconomicTile.js'
import {
    GrowSettlements,
    HydratedGrowSettlements,
    isGrowSettlements
} from '../actions/growSettlements.js'
import {
    HydratedProduceAtBases,
    ProduceAtBases,
    isProduceAtBases
} from '../actions/produceAtBases.js'
import {
    HydratedRollInitiative,
    RollInitiative,
    isRollInitiative
} from '../actions/rollInitiative.js'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterEconomicPhase, stateAfterGrowth, stateForEconomicTile } from './transitions.js'

abstract class SystemStepHandler<Action extends HydratedAction> implements MachineStateHandler<
    Action,
    HydratedStellarHorizonsGameState
> {
    protected abstract readonly systemAction: TSchema

    abstract isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is Action

    abstract onAction(
        action: Action,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(this.systemAction)
    }
}

export class EconomicPhaseStateHandler extends SystemStepHandler<HydratedDrawEconomicTile> {
    protected readonly systemAction = DrawEconomicTile

    isValidAction(action: HydratedAction): action is HydratedDrawEconomicTile {
        return isDrawEconomicTile(action)
    }

    onAction(
        action: HydratedDrawEconomicTile,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        assertExists(action.metadata, 'The economic tile was drawn')
        return stateForEconomicTile(context.gameState, action.metadata.tile)
    }
}

export class RollingInitiativeStateHandler extends SystemStepHandler<HydratedRollInitiative> {
    protected readonly systemAction = RollInitiative

    isValidAction(action: HydratedAction): action is HydratedRollInitiative {
        return isRollInitiative(action)
    }

    onAction(
        _action: HydratedRollInitiative,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterEconomicPhase(context.gameState)
    }
}

export class ProducingAtBasesStateHandler extends SystemStepHandler<HydratedProduceAtBases> {
    protected readonly systemAction = ProduceAtBases

    isValidAction(action: HydratedAction): action is HydratedProduceAtBases {
        return isProduceAtBases(action)
    }

    onAction(
        _action: HydratedProduceAtBases,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterEconomicPhase(context.gameState)
    }
}

export class GrowingSettlementsStateHandler extends SystemStepHandler<HydratedGrowSettlements> {
    protected readonly systemAction = GrowSettlements

    isValidAction(action: HydratedAction): action is HydratedGrowSettlements {
        return isGrowSettlements(action)
    }

    onAction(
        _action: HydratedGrowSettlements,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterGrowth(context.gameState)
    }
}
