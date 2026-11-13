import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedCallKing, isCallKing } from '../actions/callKing.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'
import { afterKingCall } from './transitions.js'

export class CallingKingStateHandler implements MachineStateHandler<
    HydratedCallKing,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedCallKing {
        return isCallKing(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): ActionType[] {
        return context.gameState.callableKings(playerId).length > 0 ? [ActionType.CallKing] : []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        state.beginTurn(state.declarerId())
    }

    onAction(
        _action: HydratedCallKing,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        const state = context.gameState
        state.finishTurn()
        return afterKingCall(state)
    }
}
