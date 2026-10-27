import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PhaseName, isTrust, type HydratedPowerGridGameState } from '../model/gameState.js'
import {
    HydratedTrustBuysResources,
    TrustBuysResources,
    isTrustBuysResources
} from '../actions/trustBuysResources.js'
import { HydratedBuyResources, isBuyResources } from '../actions/buyResources.js'
import { enterTurnPhase } from './turnPhase.js'
import { runSystemAction } from './systemAction.js'

type Context = MachineContext<HydratedPowerGridGameState>

/** Phase 3, in reverse player order (Recharged p. 4). */
export class BuyingResourcesStateHandler implements MachineStateHandler<
    HydratedBuyResources,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isBuyResources(action)
    }

    validActionsForPlayer(playerId: string, context: Context): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.BuyResources] : []
    }

    enter(context: Context) {
        const state = context.gameState
        enterTurnPhase(state, PhaseName.Resources, state.buyingOrder())
    }

    onAction(_action: HydratedBuyResources, context: Context): MachineState {
        return nextBuyer(context.gameState)
    }
}

export function nextBuyer(state: HydratedPowerGridGameState): MachineState {
    const next = state.nextUndone(state.buyingOrder())
    if (next !== undefined && isTrust(next)) {
        return MachineState.TrustBuying
    }
    return next ? MachineState.BuyingResources : MachineState.Building
}

export class TrustBuyingStateHandler implements MachineStateHandler<
    HydratedTrustBuysResources,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isTrustBuysResources(action)
    }

    validActionsForPlayer(_playerId: string, _context: Context): ActionType[] {
        return []
    }

    enter(context: Context) {
        context.gameState.enterPhase(PhaseName.Resources)
        runSystemAction(context, TrustBuysResources)
    }

    onAction(_action: HydratedTrustBuysResources, context: Context): MachineState {
        return nextBuyer(context.gameState)
    }
}
