import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedLoseValue, isLoseValue } from '../actions/loseValue.js'
import { ScoreHuts } from '../actions/scoreHuts.js'
import { nanoid } from 'nanoid'

// Transition from LosingValue(LoseValue) -> Bidding
export class LosingValueStateHandler implements MachineStateHandler<HydratedLoseValue, HydratedKaivaiGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedKaivaiGameState>): action is HydratedLoseValue {
        return action.type === ActionType.LoseValue
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedKaivaiGameState>): ActionType[] {
        return [ActionType.LoseValue]
    }

    enter(context: MachineContext<HydratedKaivaiGameState>) {
        const gameState = context.gameState

        gameState.phases.startPhase(PhaseName.LosingValue, gameState.actionCount)
        gameState.activePlayerIds = []
    }

    onAction(action: HydratedLoseValue, context: MachineContext<HydratedKaivaiGameState>): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isLoseValue(action): {
                gameState.phases.endPhase(gameState.actionCount)
                gameState.rounds.endRound(gameState.actionCount)

                if (gameState.cultTiles === 0) {
                    context.addSystemAction(ScoreHuts)
                    return MachineState.FinalScoring
                } else {
                    return MachineState.Bidding
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
