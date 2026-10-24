import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedEndPhase, isEndPhase } from '../actions/endPhase.js'
import { HydratedScrapShip, isScrapShip } from '../actions/scrapShip.js'
import { HydratedSkipPhase, SkipPhase, isSkipPhase } from '../actions/skipPhase.js'
import { HydratedTransferCargo, isTransferCargo } from '../actions/transferCargo.js'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { canTransferAnyCargo } from '../model/cargoTransfer.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { isIdleInPhase } from '../model/idlePhases.js'
import type { SpanPhase } from '../model/turn.js'
import { branchPlayerId, branchingState, playState } from '../model/turnPlan.js'
import { type ConversionAction, conversionActions, isConversion } from './conversions.js'

type AnytimeAction =
    | HydratedScrapShip
    | HydratedTransferCargo
    | HydratedEndPhase
    | HydratedSkipPhase
    | ConversionAction

// Rulebook 1.2 and 1.8: a ship may be scrapped, and settlements moved between a player's own
// ships, at any point in the player's turn; in the campaign an IP may be turned into $1B.
export abstract class PlayStateHandler<
    Action extends HydratedAction
> implements MachineStateHandler<Action | AnytimeAction, HydratedStellarHorizonsGameState> {
    protected abstract readonly phase: SpanPhase

    protected abstract isPhaseAction(action: HydratedAction): action is Action

    protected abstract phaseActions(
        playerId: string,
        state: HydratedStellarHorizonsGameState
    ): ActionType[]

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is Action | AnytimeAction {
        return (
            this.isPhaseAction(action) ||
            isScrapShip(action) ||
            isTransferCargo(action) ||
            isSkipPhase(action) ||
            isConversion(action) ||
            (isEndPhase(action) && action.phase === this.phase)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        const anytime: ActionType[] = []
        if (state.shipsOf(playerId).length > 0) {
            anytime.push(ActionType.ScrapShip)
        }
        if (canTransferAnyCargo(state, playerId)) {
            anytime.push(ActionType.TransferCargo)
        }
        anytime.push(...conversionActions(state, playerId))
        return [
            ...new Set([...this.phaseActions(playerId, state), ...anytime, ActionType.EndPhase])
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const playerId = branchPlayerId(state)
        if (isIdleInPhase(state, playerId, this.phase)) {
            context.addSystemAction(SkipPhase, { playerId })
        }
    }

    onAction(
        action: Action | AnytimeAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return isEndPhase(action) || isSkipPhase(action)
            ? branchingState(this.phase)
            : playState(this.phase)
    }
}
