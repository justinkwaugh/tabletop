import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedAnnounce, isAnnounce } from '../actions/announce.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'
import { toPlay } from './transitions.js'

export class AnnouncingStateHandler implements MachineStateHandler<
    HydratedAnnounce,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedAnnounce {
        return isAnnounce(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): ActionType[] {
        return context.gameState.activePlayerIds.includes(playerId) ? [ActionType.Announce] : []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        state.beginTurn(state.nextAnnouncer())
    }

    onAction(
        _action: HydratedAnnounce,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        const state = context.gameState
        state.finishTurn()
        return state.isAnnouncingOver() ? toPlay(state) : MachineState.Announcing
    }
}
