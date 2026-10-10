import { type HydratedAction, type MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { VictoryKind, type HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { beginRound, finishTurn } from '../model/turns.js'
import { declareVictory, marginalVictor } from '../model/victory.js'
import { StepStateHandler, playMachineState } from './stepStateHandler.js'

export class CommandingStateHandler extends StepStateHandler {
    protected readonly actions = [
        { type: ActionType.Move },
        { type: ActionType.Attach },
        {
            type: ActionType.ThreatenAttack,
            allowed: (state: HydratedNapoleonsTriumphGameState) => !state.currentRound.night
        },
        { type: ActionType.EndTurn }
    ]

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        return state.turnPlayerId
    }

    override enter(context: MachineContext<HydratedNapoleonsTriumphGameState>) {
        const state = context.gameState
        if (state.rounds.currentRound === undefined) {
            beginRound(state)
        }
        super.enter(context)
    }

    override onAction(
        action: HydratedAction,
        context: MachineContext<HydratedNapoleonsTriumphGameState>
    ): MachineState {
        const state = context.gameState
        if (action.type !== ActionType.EndTurn) {
            return playMachineState(state)
        }
        if (finishTurn(state)) {
            return MachineState.Commanding
        }
        declareVictory(state, marginalVictor(state), VictoryKind.Marginal)
        return MachineState.EndOfGame
    }
}
