import { ActionSource, assert } from '@tabletop/common'
import { SantiagoRuntime } from '../runtime.js'
import { ActionType } from '../actions.js'
import { MachineState } from '../states.js'
import type { SantiagoProjectedState } from '../../model/gameState.js'
import { SquareType } from '../../model/board.js'
import { validCanalPlacements, validNeutralTilePlacements } from '../../util/placement.js'

export function nextAction(state: SantiagoProjectedState, gameId: string) {
    const playerId = state.activePlayerIds[0]
    const action = {
        id: `action-${state.actionCount}`,
        gameId,
        playerId,
        source: ActionSource.User
    }
    switch (state.machineState) {
        case MachineState.SpringPlacement:
            return { ...action, type: ActionType.PlaceSpring, col: 2, row: 1 }
        case MachineState.Bidding:
            return { ...action, type: ActionType.PlaceBid, amount: 0 }
        case MachineState.PlantingPhase: {
            if (state.planterIndex >= state.plantersOrder.length) {
                const placement = validNeutralTilePlacements(state.board)[0]
                assert(placement, 'Neutral tile requires a placement')
                return { ...action, type: ActionType.PlaceNeutralTile, ...placement }
            }
            for (let col = 0; col < 8; col++) {
                for (let row = 0; row < 6; row++) {
                    if (state.board.squares[col][row].type === SquareType.Empty)
                        return { ...action, type: ActionType.PlaceField, col, row, tileIndex: 0 }
                }
            }
            return { ...action, type: ActionType.Pass }
        }
        case MachineState.CanalBuilding: {
            const segment = validCanalPlacements(state.board)[0]
            assert(segment, 'Canal building requires a segment')
            if (state.canalProposalIndex < state.canalProposalOrder.length) {
                const player = SantiagoRuntime.hydrator.hydrateState(state).getPlayerState(playerId)
                return player.getMoney() > 0
                    ? { ...action, type: ActionType.ProposeCanal, segment, amount: 1 }
                    : { ...action, type: ActionType.Pass }
            }
            return {
                ...action,
                type: ActionType.OverseerDecision,
                segment: state.canalProposals[0]?.segment ?? segment,
                accepting: state.canalProposals.length > 0
            }
        }
        case MachineState.ExtraIrrigation:
            return { ...action, type: ActionType.Pass }
        default:
            throw new Error('No action after game end')
    }
}
