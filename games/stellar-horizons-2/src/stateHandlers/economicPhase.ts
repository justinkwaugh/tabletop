import type { TSchema } from 'typebox'
import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { HydratedChooseEconomicTile, isChooseEconomicTile } from '../actions/chooseEconomicTile.js'
import {
    DrawEconomicTile,
    HydratedDrawEconomicTile,
    isDrawEconomicTile
} from '../actions/drawEconomicTile.js'
import {
    DrawTradeGoods,
    HydratedDrawTradeGoods,
    isDrawTradeGoods
} from '../actions/drawTradeGoods.js'
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
    HydratedReduceTransferMarkers,
    ReduceTransferMarkers,
    isReduceTransferMarkers
} from '../actions/reduceTransferMarkers.js'
import {
    HydratedRollInitiative,
    RollInitiative,
    isRollInitiative
} from '../actions/rollInitiative.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { economicTileChooser } from '../model/economy.js'
import { firstPhase } from '../model/turnPlan.js'
import { type ConversionAction, conversionActions, isConversion } from './conversions.js'
import {
    stateAfterEconomicPhase,
    stateAfterGrowth,
    stateAfterGoodsDraw,
    stateForEconomicTile,
    startPhase
} from './transitions.js'

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

type EconomicTileAction = HydratedDrawEconomicTile | HydratedChooseEconomicTile | ConversionAction

// Rulebook 4.0: the turn's economic tile is drawn, or chosen by Hive Mind's owner.
export class EconomicPhaseStateHandler implements MachineStateHandler<
    EconomicTileAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(action: HydratedAction): action is EconomicTileAction {
        return isDrawEconomicTile(action) || isChooseEconomicTile(action) || isConversion(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [ActionType.ChooseEconomicTile, ...conversionActions(state, playerId)]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const chooser = economicTileChooser(state)
        state.activePlayerIds = chooser === undefined ? [] : [chooser]
        if (chooser === undefined) {
            context.addSystemAction(DrawEconomicTile)
        }
    }

    onAction(
        action: EconomicTileAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        if (isConversion(action)) {
            return MachineState.EconomicPhase
        }
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

export class DrawingTradeGoodsStateHandler extends SystemStepHandler<HydratedDrawTradeGoods> {
    protected readonly systemAction = DrawTradeGoods

    isValidAction(action: HydratedAction): action is HydratedDrawTradeGoods {
        return isDrawTradeGoods(action)
    }

    onAction(
        _action: HydratedDrawTradeGoods,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterGoodsDraw(context.gameState)
    }
}

// The campaign drops the transfer markers once the economic phase is over (rulebook 1.0).
export class ReducingTransferMarkersStateHandler extends SystemStepHandler<HydratedReduceTransferMarkers> {
    protected readonly systemAction = ReduceTransferMarkers

    isValidAction(action: HydratedAction): action is HydratedReduceTransferMarkers {
        return isReduceTransferMarkers(action)
    }

    onAction(
        _action: HydratedReduceTransferMarkers,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return startPhase(context.gameState, firstPhase(context.gameState))
    }
}
