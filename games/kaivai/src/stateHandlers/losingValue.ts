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
import { ScoreHuts } from 'src/actions/scoreHuts.js'
import { nanoid } from 'nanoid'

// Transition from LosingValue(LoseValue) -> Bidding
export class LosingValueStateHandler implements MachineStateHandler<HydratedLoseValue> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is HydratedLoseValue {
        return action.type === ActionType.LoseValue
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext): ActionType[] {
        return [ActionType.LoseValue]
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState

        gameState.phases.startPhase(PhaseName.LosingValue, gameState.actionCount)
        gameState.activePlayerIds = []
    }

    onAction(action: HydratedLoseValue, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState

        switch (true) {
            case isLoseValue(action): {
                gameState.phases.endPhase(gameState.actionCount)
                gameState.rounds.endRound(gameState.actionCount)

                if (gameState.cultTiles === 0) {
                    const scoreHutsAction: ScoreHuts = {
                        type: ActionType.ScoreHuts,
                        id: nanoid(),
                        gameId: action.gameId,
                        source: ActionSource.System
                    }

                    context.addPendingAction(scoreHutsAction)
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
