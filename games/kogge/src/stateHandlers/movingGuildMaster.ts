import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedMoveGuildMaster, isMoveGuildMaster } from '../actions/moveGuildMaster.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { finishesGame } from '../model/guildMaster.js'

export class MovingGuildMasterStateHandler implements MachineStateHandler<
    HydratedMoveGuildMaster,
    HydratedKoggeGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): action is HydratedMoveGuildMaster {
        return (
            isMoveGuildMaster(action) &&
            HydratedMoveGuildMaster.canMoveGuildMaster(context.gameState, action.playerId)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        return HydratedMoveGuildMaster.canMoveGuildMaster(context.gameState, playerId)
            ? [ActionType.MoveGuildMaster]
            : []
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        const state = context.gameState
        state.activePlayerIds = [state.turnManager.turnOrder[0]]
    }

    // Rulebook: once the guild master completes his second lap the round is not played out.
    onAction(
        _action: HydratedMoveGuildMaster,
        context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        const state = context.gameState
        if (finishesGame(state.guildMaster)) {
            state.rounds.endRound(state.actionCount)
            return MachineState.EndOfGame
        }
        return MachineState.TakingTurn
    }
}
