import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedMarracashGameState } from '../model/gameState.js'

type ChoosingActionAction = HydratedAction

export class ChoosingActionStateHandler implements MachineStateHandler<
    ChoosingActionAction,
    HydratedMarracashGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedMarracashGameState>
    ): _action is ChoosingActionAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedMarracashGameState>
    ): string[] {
        return []
    }

    enter(_context: MachineContext<HydratedMarracashGameState>) {}

    onAction(
        _action: ChoosingActionAction,
        _context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        throw Error('Invalid action type')
    }
}
