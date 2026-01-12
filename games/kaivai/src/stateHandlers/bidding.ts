import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { PhaseName } from '../definition/phases.js'

// Transition from Bidding(PlaceBid) -> PlaceBid | InitialHuts | PlacingGod
export class BiddingStateHandler implements MachineStateHandler<HydratedPlaceBid, HydratedKaivaiGameState> {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedKaivaiGameState>): action is HydratedPlaceBid {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedKaivaiGameState>): ActionType[] {
        if (this.isValidActionType(ActionType.PlaceBid, playerId, context)) {
            return [ActionType.PlaceBid]
        } else {
            return []
        }
    }

    enter(context: MachineContext<HydratedKaivaiGameState>) {
        const gameState = context.gameState
        if (!gameState.rounds.currentRound) {
            gameState.rounds.startRound(gameState.actionCount + 1)
        }

        let nextPlayerId
        if (!gameState.phases.currentPhase) {
            gameState.bids = {}
            gameState.phases.startPhase(PhaseName.Bidding, gameState.actionCount)
            // Set turn order for bidding.. lowest score, money, fish, boats, huts
            if (gameState.rounds.currentRound && gameState.rounds.currentRound.number > 1) {
                gameState.turnManager.turnOrder = gameState.playersOrderedByAscendingWealth()
            }
            nextPlayerId = gameState.turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        }

        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(action: HydratedPlaceBid, context: MachineContext<HydratedKaivaiGameState>): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isPlaceBid(action): {
                gameState.turnManager.endTurn(gameState.actionCount)

                if (Object.keys(gameState.bids).length === gameState.players.length) {
                    const turnOrder = Object.entries(gameState.bids)
                        .toSorted((a, b) => b[1] - a[1])
                        .map(([playerId]) => playerId)
                    gameState.turnManager.turnOrder = turnOrder

                    gameState.phases.endPhase(gameState.actionCount)
                    if (gameState.rounds.currentRound?.number === 1) {
                        return MachineState.InitialHuts
                    } else {
                        return MachineState.MovingGod
                    }
                } else {
                    return MachineState.Bidding
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedKaivaiGameState>
    ): boolean {
        const gameState = context.gameState
        switch (actionType) {
            case ActionType.PlaceBid: {
                return gameState.bids[playerId] === undefined
            }
            default:
                return false
        }
    }
}
