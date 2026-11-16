import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedChooseContract, isChooseContract } from '../actions/chooseContract.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'
import { afterContract } from './transitions.js'

export class ChoosingContractStateHandler implements MachineStateHandler<
    HydratedChooseContract,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedChooseContract {
        return isChooseContract(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): ActionType[] {
        return playerId === context.gameState.forehandId() ? [ActionType.ChooseContract] : []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        state.beginTurn(state.forehandId())
    }

    onAction(
        _action: HydratedChooseContract,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        const state = context.gameState
        state.finishTurn()
        return afterContract(state)
    }
}
