import type { HydratedAction } from '@tabletop/common'
import { HydratedTransferCargo, isTransferCargo } from '../actions/transferCargo.js'
import { ActionType } from '../definition/actions.js'
import { canTransferAnyCargo } from '../model/cargoTransfer.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { PlayStateHandler } from './playing.js'

export class TransferringCargoStateHandler extends PlayStateHandler<HydratedTransferCargo> {
    protected readonly phase = TurnPhase.Cargo

    protected isPhaseAction(action: HydratedAction): action is HydratedTransferCargo {
        return isTransferCargo(action)
    }

    protected phaseActions(playerId: string, state: HydratedStellarHorizonsGameState) {
        return canTransferAnyCargo(state, playerId) ? [ActionType.TransferCargo] : []
    }
}
