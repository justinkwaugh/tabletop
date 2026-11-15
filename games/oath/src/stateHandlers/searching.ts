import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isSearchResolve } from '../actions/searchResolve.js'
import { HydratedSearchSwap, isSearchSwap } from '../actions/searchSwap.js'
import { isPlayerActionOfType, phaseAfterActPhaseAction } from './handlerSupport.js'

/** R-5.1.3, R-5.1.4, R-4.2 — mid-Search, nothing else is offered but Great Spire's swap. */
export class SearchingStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.SearchResolve, ActionType.SearchSwap)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return HydratedSearchSwap.canDoSearchSwap(context.gameState, playerId)
            ? [ActionType.SearchResolve, ActionType.SearchSwap]
            : [ActionType.SearchResolve]
    }

    enter(_context: MachineContext<HydratedOathGameState>) {}

    onAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): MachineState {
        if (isSearchResolve(action)) {
            return phaseAfterActPhaseAction(action.metadata)
        }
        // Great Spire — the draw swapped, the Search goes on to its discard and play.
        if (isSearchSwap(action)) return MachineState.Searching
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
