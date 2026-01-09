import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedScoreHuts, isScoreHuts } from '../actions/scoreHuts.js'
import {
    ChooseScoringIsland,
    HydratedChooseScoringIsland,
    isChooseScoringIsland
} from '../actions/chooseScoringIsland.js'
import { HydratedScoreIsland, isScoreIsland, ScoreIsland } from '../actions/scoreIsland.js'
import { nanoid } from 'nanoid'
import { PhaseName } from '../definition/phases.js'

// Transition from FinalScoring(ScoreHuts) -> FinalScoring
//                 FinalScoring(ChooseScoringIsland) -> IslandBidding | FinalScoring
//                 FinalScoring(ScoreIsland) -> FinalScoring | EndOfGame

type FinalScoringAction = HydratedScoreHuts | HydratedChooseScoringIsland | HydratedScoreIsland

export class FinalScoringStateHandler implements MachineStateHandler<FinalScoringAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is FinalScoringAction {
        const gameState = context.gameState as HydratedKaivaiGameState
        if (action.source === ActionSource.User && !action.playerId) return false

        if (!gameState.hutsScored) {
            return action.type === ActionType.ScoreHuts
        } else if (gameState.chosenIsland) {
            return action.type === ActionType.ScoreIsland
        } else if (gameState.islandsToScore.length > 0) {
            return action.type === ActionType.ChooseScoringIsland
        }
        return false
    }

    validActionsForPlayer(_playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedKaivaiGameState
        return gameState.islandsToScore.length > 0 ? [ActionType.ChooseScoringIsland] : []
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState
        if (!gameState.hutsScored) {
            gameState.phases.startPhase(PhaseName.FinalScoring, gameState.actionCount)
            gameState.activePlayerIds = []
            return
        }

        const nextPlayerId = gameState.playersOrderedByAscendingWealth()[0]
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(action: FinalScoringAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState
        switch (true) {
            case isScoreHuts(action): {
                gameState.hutsScored = true
                gameState.islandsToScore = Object.keys(gameState.board.islands)

                const autoChosenIsland = this.autoChooseIsland(gameState)
                if (autoChosenIsland) {
                    context.addSystemAction(ChooseScoringIsland, { islandId: autoChosenIsland })
                }
                return MachineState.FinalScoring
            }
            case isChooseScoringIsland(action): {
                gameState.bids = {}

                const isUncontested = gameState.board.isUncontestableForScoring(
                    gameState.players,
                    action.islandId
                )

                // Check to see if anyone has influence to bid
                const playersWithInfluence = gameState.players
                    .filter((player) => player.influence > 0)
                    .map((player) => player.playerId)

                if (isUncontested || playersWithInfluence.length === 0) {
                    // Score the island
                    context.addSystemAction(ScoreIsland, { islandId: action.islandId })
                    return MachineState.FinalScoring
                } else {
                    gameState.bidders = playersWithInfluence
                    return MachineState.IslandBidding
                }
            }
            case isScoreIsland(action): {
                gameState.chosenIsland = undefined

                if (gameState.islandsToScore.length === 0) {
                    gameState.phases.endPhase(gameState.actionCount)
                    return MachineState.EndOfGame
                }

                const autoChosenIsland = this.autoChooseIsland(gameState)
                if (autoChosenIsland) {
                    context.addSystemAction(ChooseScoringIsland, { islandId: autoChosenIsland })
                }

                return MachineState.FinalScoring
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    autoChooseIsland(gameState: HydratedKaivaiGameState): string | undefined {
        if (gameState.islandsToScore.length === 1) {
            return gameState.islandsToScore[0]
        }

        const playersHaveInfluence = gameState.players.some((player) => player.influence > 0)
        if (!playersHaveInfluence) {
            return gameState.islandsToScore[0]
        }

        return undefined
    }
}
