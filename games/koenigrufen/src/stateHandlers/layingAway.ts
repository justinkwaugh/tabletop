import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedLayAway, isLayAway } from '../actions/layAway.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'
import { toAnnouncements } from './transitions.js'

export class LayingAwayStateHandler implements MachineStateHandler<
    HydratedLayAway,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedLayAway {
        return isLayAway(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): ActionType[] {
        return playerId === context.gameState.declarerId() ? [ActionType.LayAway] : []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        state.beginTurn(state.declarerId())
    }

    onAction(
        _action: HydratedLayAway,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        const state = context.gameState
        state.finishTurn()
        return toAnnouncements(state)
    }
}
