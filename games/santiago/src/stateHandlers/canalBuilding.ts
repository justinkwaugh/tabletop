import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedProposeCanal, isProposeCanal } from '../actions/proposeCanal.js'
import { HydratedOverseerDecision, isOverseerDecision } from '../actions/overseerDecision.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { isSameSegment } from '../model/board.js'
import { isCanalPlaced, isConnectedToSpring } from '../util/irrigation.js'
import { maxSegmentTotal } from '../util/canal.js'

type CanalBuildingAction = HydratedProposeCanal | HydratedOverseerDecision | HydratedPass

// Phase 4: Canal building.
// Sub-phase A (proposal): non-overseer players sequentially propose a canal location + escudo offer (or pass).
// Sub-phase B (decision): overseer accepts one proposed segment (takes offered money) or rejects
//   all (places own segment, pays bank maxOffer+1 escudos).
//
// canalProposalIndex sentinel:
//   -1 = fresh entry from PlantingPhase (not yet set up)
//   0..n-1 = proposal phase; player at that index is proposing
//   n = overseer decision phase
export class CanalBuildingStateHandler
    implements MachineStateHandler<CanalBuildingAction, HydratedSantiagoGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): action is CanalBuildingAction {
        if (!action.playerId) return false
        const state = context.gameState
        const inProposalPhase = state.canalProposalIndex < state.canalProposalOrder.length

        if (inProposalPhase) {
            const currentProposer = state.canalProposalOrder[state.canalProposalIndex]
            if (action.playerId !== currentProposer) return false

            if (isPass(action)) return true

            if (isProposeCanal(action)) {
                // Bribe must be at least 1 escudo; segment must be unplaced and connected
                if (action.amount < 1) return false
                if (!isConnectedToSpring(state.board, action.segment)) return false
                if (isCanalPlaced(state.board, action.segment)) return false
                const player = state.getPlayerState(action.playerId)
                return action.amount <= player.money
            }

            return false
        }

        // Overseer decision phase
        if (action.playerId !== state.canalOverseerId) return false

        if (isOverseerDecision(action)) {
            if (isCanalPlaced(state.board, action.segment)) return false
            if (!isConnectedToSpring(state.board, action.segment)) return false

            if (action.accepting) {
                // Must have at least one proposal at this segment
                return state.canalProposals.some((p) => isSameSegment(p.segment, action.segment))
            } else {
                // Rejecting: overseer pays max(combined segment total) + 1
                const penalty = maxSegmentTotal(state.canalProposals)
                const overseer = state.getPlayerState(state.canalOverseerId!)
                return overseer.money >= (penalty > 0 ? penalty + 1 : 0)
            }
        }

        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSantiagoGameState>
    ): ActionType[] {
        const state = context.gameState
        const inProposalPhase = state.canalProposalIndex < state.canalProposalOrder.length

        if (inProposalPhase) {
            const currentProposer = state.canalProposalOrder[state.canalProposalIndex]
            if (playerId !== currentProposer) return []
            return [ActionType.ProposeCanal, ActionType.Pass]
        }

        if (playerId !== state.canalOverseerId) return []
        return [ActionType.OverseerDecision]
    }

    enter(context: MachineContext<HydratedSantiagoGameState>) {
        const state = context.gameState

        if (state.canalProposalIndex === -1) {
            // Fresh entry from PlantingPhase — set up proposal order
            const turnOrder = state.turnManager.turnOrder
            const overseerIdx = state.canalOverseerId
                ? turnOrder.indexOf(state.canalOverseerId)
                : -1
            const startIdx = overseerIdx >= 0 ? (overseerIdx + 1) % turnOrder.length : 0
            // All players except the overseer, starting left of overseer clockwise
            const proposalOrder = [
                ...turnOrder.slice(startIdx),
                ...turnOrder.slice(0, startIdx)
            ].filter((id) => id !== state.canalOverseerId)
            state.canalProposalOrder = proposalOrder
            state.canalProposals = []
            state.canalProposalIndex = 0
        }

        const isProposalPhase = state.canalProposalIndex < state.canalProposalOrder.length
        if (isProposalPhase) {
            const currentProposer = state.canalProposalOrder[state.canalProposalIndex]
            state.activePlayerIds = [currentProposer]
            // Auto-pass players who can't afford the minimum 1-escudo bribe
            if (state.getPlayerState(currentProposer).money === 0) {
                context.addSystemAction(Pass, { playerId: currentProposer })
            }
        } else {
            // Overseer decision phase
            state.activePlayerIds = state.canalOverseerId ? [state.canalOverseerId] : []
        }
    }

    onAction(
        action: CanalBuildingAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        const state = context.gameState

        if (isProposeCanal(action) || isPass(action)) {
            // ProposeCanal.apply() already recorded the proposal; Pass has no apply effect
            state.canalProposalIndex++
            // enter() will activate next proposer or overseer
            return MachineState.CanalBuilding
        }

        if (isOverseerDecision(action)) {
            // OverseerDecision.apply() already placed the canal and transferred money
            return MachineState.ExtraIrrigation
        }

        throw new Error(`Unexpected action in CanalBuilding: ${(action as CanalBuildingAction).type}`)
    }
}
