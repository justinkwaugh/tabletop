import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { TileType } from '../components/tiles.js'
import { HydratedDrawTile, isDrawTile } from '../actions/drawTile.js'
import { HydratedPlaceDisk, isPlaceDisk } from '../actions/placeDisk.js'
import { StartAuction } from '../actions/startAuction.js'
import { nanoid } from 'nanoid'
import { FreshFishGameConfig } from '../definition/gameConfig.js'
import { ActionType } from '../definition/actions.js'

type StartOfTurnAction = HydratedPlaceDisk | HydratedDrawTile

// Transition from StartOfTurn(PlaceDisk) -> StartOfTurn
//                 StartOfTurn(DrawTile) -> MarketTileDrawn (when market tile drawn)
//                 StartOfTurn(DrawTile) -> StallTileDrawn (when stall tile is drawn)
export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is StartOfTurnAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const validActions: ActionType[] = []
        if (this.isValidActionType(ActionType.PlaceDisk, playerId, context)) {
            validActions.push(ActionType.PlaceDisk)
        }

        if (this.isValidActionType(ActionType.DrawTile, playerId, context)) {
            validActions.push(ActionType.DrawTile)
        }

        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedFreshFishGameState

        // If we are not still in the middle of a turn, start a new turn
        if (!gameState.turnManager.currentTurn()) {
            const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
            gameState.activePlayerIds = [nextPlayerId]
        }
    }

    onAction(action: StartOfTurnAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedFreshFishGameState

        switch (true) {
            case isPlaceDisk(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.StartOfTurn
            }
            case isDrawTile(action): {
                if (!gameState.chosenTile) {
                    throw Error('No tile chosen')
                }

                switch (gameState.chosenTile.type) {
                    case TileType.Market: {
                        action.metadata = { chosenTile: gameState.chosenTile }
                        return MachineState.MarketTileDrawn
                    }
                    case TileType.Stall: {
                        action.metadata = { chosenTile: gameState.chosenTile }

                        // Automatically start the auction
                        const startAuctionAction = <StartAuction>{
                            type: ActionType.StartAuction,
                            id: nanoid(),
                            playerId: action.playerId,
                            gameId: action.gameId,
                            source: ActionSource.System
                        }
                        context.addPendingAction(startAuctionAction)
                        return MachineState.StallTileDrawn
                    }
                }
                break
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext
    ): boolean {
        const gameState = context.gameState as HydratedFreshFishGameState
        const gameConfig = context.gameConfig as FreshFishGameConfig

        if (actionType === ActionType.PlaceDisk && gameState.getPlayerState(playerId).hasDisk()) {
            return true
        }

        if (
            actionType === ActionType.DrawTile &&
            gameState.getPlayerState(playerId).hasDiskOnBoard() &&
            gameState.turnManager.turnCount(playerId) >= (gameConfig.numTurnsWithDisksToStart ?? 3)
        ) {
            return true
        }

        return false
    }
}
