import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext
} from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceStall, PlaceStall } from '../actions/placeStall.js'
import { ActionType } from '../definition/actions.js'
import { CellType, isDiskCell, isEmptyCell } from '../components/cells.js'
import { nanoid } from 'nanoid'

// Transition from TileBagEmptiedStateHandler(PlaceStall) -> TileBagEmptiedStateHandler (for next player)
//                 TileBagEmptiedStateHandler(PlaceStall) -> GameEnded (when all stalls are placed)
export class TileBagEmptiedStateHandler implements MachineStateHandler<HydratedPlaceStall> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is HydratedPlaceStall {
        return action.type === ActionType.PlaceStall
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext): string[] {
        return [ActionType.PlaceStall]
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedFreshFishGameState
        this.selectNextFinalStallAndPlayer(gameState, context)
    }

    onAction(action: HydratedPlaceStall, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedFreshFishGameState

        // Remove placed stall from final stalls list
        gameState.finalStalls.shift()

        if (gameState.finalStalls.length === 0) {
            gameState.activePlayerIds = []
            for (const boardCell of gameState.board) {
                if (isDiskCell(boardCell.cell) || isEmptyCell(boardCell.cell)) {
                    gameState.board.setCell(boardCell.coords, { type: CellType.Road })
                    if (isDiskCell(boardCell.cell)) {
                        gameState.getPlayerState(boardCell.cell.playerId).addDisks(1)
                    }
                }
            }
            return MachineState.EndOfGame
        } else {
            // Just return back to here
            return MachineState.TileBagEmptied
        }
    }

    selectNextFinalStallAndPlayer(gameState: HydratedFreshFishGameState, context: MachineContext) {
        if (gameState.finalStalls.length === 0) {
            throw Error('No more final stalls to place')
        }

        const nextFinalStall = gameState.finalStalls[0]
        const nextPlayer = gameState.players.find((player) => {
            return player.stalls.find(
                (stall) => stall.goodsType === nextFinalStall.goodsType && !stall.placed
            )
        })

        if (!nextPlayer) {
            throw Error('No player found to place first final stall')
        }

        gameState.chosenTile = structuredClone(nextFinalStall)
        gameState.activePlayerIds = [nextPlayer.playerId]

        // Place into the void if player has no disks on the board
        if (!nextPlayer.hasDiskOnBoard()) {
            context.addSystemAction(PlaceStall, {
                playerId: nextPlayer.playerId,
                goodsType: nextFinalStall.goodsType
            })
        }
    }
}
