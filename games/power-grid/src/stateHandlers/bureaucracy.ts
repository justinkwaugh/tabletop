import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PhaseName, type HydratedPowerGridGameState } from '../model/gameState.js'
import { HydratedStartStep2, StartStep2, isStartStep2 } from '../actions/startStep2.js'
import { HydratedPowerCities, isPowerCities } from '../actions/powerCities.js'
import { HydratedRestock, Restock, isRestock } from '../actions/restock.js'
import { runSystemAction } from './systemAction.js'

type Context = MachineContext<HydratedPowerGridGameState>

export class StartingStep2StateHandler implements MachineStateHandler<
    HydratedStartStep2,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isStartStep2(action)
    }

    validActionsForPlayer(_playerId: string, _context: Context): ActionType[] {
        return []
    }

    enter(context: Context) {
        context.gameState.enterPhase(PhaseName.Bureaucracy)
        runSystemAction(context, StartStep2)
    }

    onAction(_action: HydratedStartStep2, _context: Context): MachineState {
        return MachineState.Powering
    }
}

/** Everyone chooses which plants to run at once. */
export class PoweringStateHandler implements MachineStateHandler<
    HydratedPowerCities,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isPowerCities(action)
    }

    validActionsForPlayer(playerId: string, context: Context): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.PowerCities] : []
    }

    enter(context: Context) {
        const state = context.gameState
        state.enterPhase(PhaseName.Bureaucracy)
        state.activePlayerIds = state.playerOrder.filter(
            (playerId) => !state.phaseDone.includes(playerId)
        )
    }

    onAction(_action: HydratedPowerCities, context: Context): MachineState {
        return context.gameState.phaseDone.length === context.gameState.players.length
            ? MachineState.Restocking
            : MachineState.Powering
    }
}

export class RestockingStateHandler implements MachineStateHandler<
    HydratedRestock,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isRestock(action)
    }

    validActionsForPlayer(_playerId: string, _context: Context): ActionType[] {
        return []
    }

    enter(context: Context) {
        runSystemAction(context, Restock)
    }

    onAction(_action: HydratedRestock, _context: Context): MachineState {
        return MachineState.ChoosingPlant
    }
}
