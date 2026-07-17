import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceField, isPlaceField } from '../actions/placeField.js'
import { HydratedPlaceNeutralTile, isPlaceNeutralTile } from '../actions/placeNeutralTile.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { SquareType } from '../model/board.js'
import { validNeutralTilePlacements } from '../util/placement.js'

type PlantingAction = HydratedPlaceField | HydratedPlaceNeutralTile | HydratedPass

// Each planting turn is a single action: the active planter places one of the
// revealedTiles directly on the board (or passes if none can be placed).
//
// In 3-player games, after all 3 planters place their tiles, one tile remains.
// The highest bidder (plantersOrder[0]) must place this as a neutral plantation:
//   - Adjacent to an irrigated plantation, or dried if none available.
//   - No farmers, no owner. It counts toward plantation size but scores nothing itself.
export class PlantingPhaseStateHandler
    implements MachineStateHandler<PlantingAction, HydratedSantiagoGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): action is PlantingAction {
        if (!action.playerId) return false
        const state = context.gameState

        // Neutral placement mode: all planters done but one tile remains (3-player)
        if (this.isNeutralPlacementMode(state)) {
            if (!isPlaceNeutralTile(action)) return false
            if (action.playerId !== state.plantersOrder[0]) return false
            return validNeutralTilePlacements(state.board).some(
                (p) => p.col === action.col && p.row === action.row
            )
        }

        const currentPlanter = state.plantersOrder[state.planterIndex]
        if (action.playerId !== currentPlanter) return false

        if (isPass(action)) {
            return state.revealedTiles.length === 0 || !this.hasAnyValidPlacement(action.playerId, state)
        }
        if (isPlaceField(action)) {
            if (action.tileIndex < 0 || action.tileIndex >= state.revealedTiles.length) return false
            return this.isValidPlacement(action.col, action.row, state)
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSantiagoGameState>
    ): ActionType[] {
        const state = context.gameState

        if (this.isNeutralPlacementMode(state)) {
            return playerId === state.plantersOrder[0] ? [ActionType.PlaceNeutralTile] : []
        }

        const currentPlanter = state.plantersOrder[state.planterIndex]
        if (playerId !== currentPlanter) return []

        if (state.revealedTiles.length > 0 && this.hasAnyValidPlacement(playerId, state)) {
            return [ActionType.PlaceField]
        }
        return [ActionType.Pass]
    }

    enter(context: MachineContext<HydratedSantiagoGameState>) {
        const state = context.gameState
        if (this.isNeutralPlacementMode(state)) {
            // Highest bidder must place the neutral tile — no auto-pass
            state.activePlayerIds = [state.plantersOrder[0]]
            return
        }
        this.startNextPlanter(state, context)
    }

    onAction(
        action: PlantingAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        const state = context.gameState

        if (isPlaceNeutralTile(action)) {
            // apply() already placed the field and consumed revealedTiles[0]
            return MachineState.CanalBuilding
        }

        // PlaceField or Pass — advance to the next planter.
        state.planterIndex++

        if (state.planterIndex >= state.plantersOrder.length) {
            // All planters done. In 3-player games, one tile remains for neutral placement.
            if (state.players.length === 3 && state.revealedTiles.length > 0) {
                return MachineState.PlantingPhase  // re-enter for neutral placement
            }
            state.revealedTiles = []
            return MachineState.CanalBuilding
        }
        return MachineState.PlantingPhase
    }

    private isNeutralPlacementMode(state: HydratedSantiagoGameState): boolean {
        return (
            state.planterIndex >= state.plantersOrder.length &&
            state.players.length === 3 &&
            state.revealedTiles.length > 0
        )
    }

    private startNextPlanter(
        state: HydratedSantiagoGameState,
        context: MachineContext<HydratedSantiagoGameState>
    ) {
        const planterId = state.plantersOrder[state.planterIndex]
        state.activePlayerIds = [planterId]

        if (state.revealedTiles.length === 0 || !this.hasAnyValidPlacement(planterId, state)) {
            context.addSystemAction(Pass, { playerId: planterId })
        }
    }

    private isValidPlacement(
        col: number,
        row: number,
        state: HydratedSantiagoGameState
    ): boolean {
        const square = state.board.squares[col]?.[row]
        return square?.type === SquareType.Empty
    }

    private hasAnyValidPlacement(playerId: string, state: HydratedSantiagoGameState): boolean {
        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 6; row++) {
                if (this.isValidPlacement(col, row, state)) return true
            }
        }
        return false
    }
}
