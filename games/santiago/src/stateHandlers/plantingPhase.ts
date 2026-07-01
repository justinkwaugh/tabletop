import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceField, isPlaceField } from '../actions/placeField.js'
import { HydratedPlaceNeutralTile, isPlaceNeutralTile } from '../actions/placeNeutralTile.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { HydratedSelectTile, isSelectTile } from '../actions/selectTile.js'
import { SquareType } from '../model/board.js'
import { validNeutralTilePlacements } from '../util/placement.js'

type PlantingAction = HydratedSelectTile | HydratedPlaceField | HydratedPlaceNeutralTile | HydratedPass

// Each planting turn has two sub-phases:
//   1. Tile selection — the active planter picks one of the remaining revealedTiles.
//   2. Tile placement — the planter places currentPlantingTile on the board (or passes).
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

        if (!state.currentPlantingTile) {
            // Tile selection sub-phase: pass is only valid (system auto-pass) when no tiles remain
            if (isPass(action)) return state.revealedTiles.length === 0
            return (
                isSelectTile(action) &&
                action.tileIndex >= 0 &&
                action.tileIndex < state.revealedTiles.length
            )
        }

        // Tile placement sub-phase
        if (isPass(action)) return true
        if (isSelectTile(action)) {
            return action.tileIndex >= 0 && action.tileIndex < state.revealedTiles.length
        }
        if (isPlaceField(action)) {
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

        if (!state.currentPlantingTile) {
            return state.revealedTiles.length > 0 ? [ActionType.SelectTile] : [ActionType.Pass]
        }

        const placementActions = this.hasAnyValidPlacement(playerId, state)
            ? [ActionType.PlaceField]
            : [ActionType.Pass]
        if (state.revealedTiles.length > 0) placementActions.push(ActionType.SelectTile)
        return placementActions
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

        if (isSelectTile(action)) {
            // Tile is now assigned (apply() already did it); self-transition so enter()
            // checks placement validity and auto-passes if needed.
            return MachineState.PlantingPhase
        }

        // PlaceField or Pass — advance to the next planter.
        state.currentPlantingTile = undefined
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

        if (!state.currentPlantingTile) {
            // Tile selection sub-phase — auto-pass only if no tiles remain
            if (state.revealedTiles.length === 0) {
                context.addSystemAction(Pass, { playerId: planterId })
            }
            return
        }

        // Tile placement sub-phase — auto-pass if no valid placements
        if (!this.hasAnyValidPlacement(planterId, state)) {
            context.addSystemAction(Pass, { playerId: planterId })
        }
    }

    private isValidPlacement(
        col: number,
        row: number,
        state: HydratedSantiagoGameState
    ): boolean {
        if (!state.currentPlantingTile) return false
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
