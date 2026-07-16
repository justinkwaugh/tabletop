import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedBuildCanal, isBuildCanal } from '../actions/buildCanal.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { isPlaceableSegment } from '../util/placement.js'
import { isIrrigated, connectedSpringIntersections } from '../util/irrigation.js'
import { isFieldSquare } from '../model/board.js'
import { HydratedEndRoundEvent, isEndRoundEvent, EndRoundEvent } from '../actions/endRoundEvent.js'

type ExtraIrrigationAction = HydratedBuildCanal | HydratedPass | HydratedEndRoundEvent

// Phase 5: Personal canal placement.
// Players each have ONE personal canal for the whole game (free to place, one-time use).
// Sequential order starting left of the new canal overseer, with the overseer asked last.
// The first player to place their canal ends Phase 5; others don't get to place.
export class ExtraIrrigationStateHandler
    implements MachineStateHandler<ExtraIrrigationAction, HydratedSantiagoGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): action is ExtraIrrigationAction {
        // Allow the system-emitted EndRoundEvent (no playerId)
        if (isEndRoundEvent(action)) return true

        if (!action.playerId) return false
        const state = context.gameState
        const current = state.extraIrrigationOrder[state.extraIrrigationIndex]
        if (action.playerId !== current) return false

        if (isPass(action)) return true

        if (isBuildCanal(action)) {
            const player = state.getPlayerState(action.playerId)
            if (!player.hasPersonalCanal) return false
            return isPlaceableSegment(state.board, action.segment)
        }

        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSantiagoGameState>
    ): ActionType[] {
        const state = context.gameState
        const current = state.extraIrrigationOrder[state.extraIrrigationIndex]
        if (playerId !== current) return []

        const player = state.getPlayerState(playerId)
        if (player.hasPersonalCanal) {
            return [ActionType.BuildCanal, ActionType.Pass]
        }
        return [ActionType.Pass]
    }

    enter(context: MachineContext<HydratedSantiagoGameState>) {
        const state = context.gameState

        // Fresh entry from CanalBuilding: extraIrrigationPassed was cleared by Bidding.enter()
        // so length === 0 means no one has acted yet this round.
        if (state.extraIrrigationPassed.length === 0) {
            const turnOrder = state.turnManager.turnOrder
            const overseerIdx = state.canalOverseerId
                ? turnOrder.indexOf(state.canalOverseerId)
                : -1
            const startIdx = overseerIdx >= 0 ? (overseerIdx + 1) % turnOrder.length : 0
            state.extraIrrigationOrder = [
                ...turnOrder.slice(startIdx),
                ...turnOrder.slice(0, startIdx)
            ]
            state.extraIrrigationIndex = 0
        }

        // All players have been asked — we're waiting for the EndRoundEvent system action.
        if (state.extraIrrigationIndex >= state.extraIrrigationOrder.length) return

        const current = state.extraIrrigationOrder[state.extraIrrigationIndex]
        const player = state.getPlayerState(current)

        // Auto-pass players who've already used their personal canal — never mark them
        // active at all, so history scrubbing (which steps through persisted actions one at
        // a time, unlike live play's single cascading engine run) doesn't land on a transient
        // "their turn, but already used" state that's never actually shown during play.
        if (!player.hasPersonalCanal) {
            context.addSystemAction(Pass, { playerId: current })
            return
        }

        state.activePlayerIds = [current]
    }

    onAction(
        action: ExtraIrrigationAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        const state = context.gameState

        // EndRoundEvent was queued by endPhase() — now apply drought/escudos and truly transition.
        if (isEndRoundEvent(action)) {
            const isLastRound = state.isBagEmpty()
            state.applyDrought(isLastRound)
            if (!isLastRound) state.collectEscudos()
            return isLastRound ? MachineState.EndOfGame : MachineState.Bidding
        }

        if (!action.playerId) throw new Error('Action requires a playerId')

        if (isBuildCanal(action)) {
            // Player used their personal canal — BuildCanal.apply() already placed it
            state.getPlayerState(action.playerId).hasPersonalCanal = false
            state.extraIrrigationPassed.push(action.playerId)
            // Advance past the end so enter() knows all players are done
            state.extraIrrigationIndex = state.extraIrrigationOrder.length
            return this.endPhase(state, context)
        }

        if (isPass(action)) {
            state.extraIrrigationPassed.push(action.playerId)
            state.extraIrrigationIndex++

            if (state.extraIrrigationIndex < state.extraIrrigationOrder.length) {
                // More players to ask — self-transition, enter() activates next player
                return MachineState.ExtraIrrigation
            }

            // All players have been asked — queue EndRoundEvent and self-transition
            return this.endPhase(state, context)
        }

        throw new Error(`Unexpected action in ExtraIrrigation: ${(action as ExtraIrrigationAction).type}`)
    }

    private computeDriedSquares(state: HydratedSantiagoGameState, isLastRound: boolean): Array<{col: number, row: number, crop: string}> {
        const result: Array<{col: number, row: number, crop: string}> = []
        const connected = connectedSpringIntersections(state.board)
        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 6; row++) {
                const sq = state.board.squares[col][row]
                if (!isFieldSquare(sq) || sq.dried) continue
                if (isIrrigated(state.board, col, row, connected)) continue
                // Field will be affected by drought
                if (isLastRound || sq.farmerCount === 0) {
                    result.push({ col, row, crop: sq.crop })
                }
            }
        }
        return result
    }

    // Fields with farmers that will lose exactly one farmer this round (but not fully dry out —
    // that's computeDriedSquares' job, for fields already at 0 farmers or the final round).
    private computeFarmerLosses(state: HydratedSantiagoGameState, isLastRound: boolean): Array<{col: number, row: number, crop: string, playerId: string}> {
        const result: Array<{col: number, row: number, crop: string, playerId: string}> = []
        if (isLastRound) return result
        const connected = connectedSpringIntersections(state.board)
        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 6; row++) {
                const sq = state.board.squares[col][row]
                if (!isFieldSquare(sq) || sq.dried) continue
                if (isIrrigated(state.board, col, row, connected)) continue
                if (sq.farmerCount > 0) {
                    result.push({ col, row, crop: sq.crop, playerId: sq.playerId })
                }
            }
        }
        return result
    }

    // Queue the EndRoundEvent (carrying drought/escudo info for the history), then
    // return a self-transition so ExtraIrrigation processes it and does the real transition.
    // Drought and escudo collection happen in onAction(EndRoundEvent) above.
    private endPhase(state: HydratedSantiagoGameState, context: MachineContext<HydratedSantiagoGameState>): MachineState {
        const isLastRound = state.isBagEmpty()
        const driedSquares = this.computeDriedSquares(state, isLastRound)
        const farmerLosses = this.computeFarmerLosses(state, isLastRound)
        context.addSystemAction(EndRoundEvent, {
            round: state.round,
            driedSquares,
            farmerLosses,
            escudosEarned: isLastRound ? 0 : 3
        })
        return MachineState.ExtraIrrigation
    }
}
