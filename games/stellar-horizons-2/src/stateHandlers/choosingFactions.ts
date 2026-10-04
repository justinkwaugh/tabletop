import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedChooseFaction, isChooseFaction } from '../actions/chooseFaction.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export class ChoosingFactionsStateHandler implements MachineStateHandler<
    HydratedChooseFaction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedChooseFaction {
        return isChooseFaction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.ChooseFaction] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const next = this.nextChooser(state)
        state.activePlayerIds = next ? [next] : []
    }

    onAction(
        _action: HydratedChooseFaction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return this.nextChooser(context.gameState)
            ? MachineState.ChoosingFactions
            : MachineState.StartOfTurn
    }

    private nextChooser(state: HydratedStellarHorizonsGameState): string | undefined {
        return state
            .initiativeOrder()
            .find((playerId) => state.getPlayerState(playerId).faction === undefined)
    }
}
