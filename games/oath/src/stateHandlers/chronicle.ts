import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { chroniclersOf } from '../util/chronicle.js'

const CHRONICLE_BEING_WRITTEN = 'The game is over; the chronicle is being written'

/**
 * R-8 — the won game's chronicle, written before the result: one state whose cursor walks the
 * steps. No title, Wake, Rest or turn runs here; only the players a step waits on act.
 */
export class ChronicleStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        throw Error(CHRONICLE_BEING_WRITTEN)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedOathGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedOathGameState>): void {
        context.gameState.activePlayerIds = chroniclersOf(context.gameState)
    }

    onAction(_action: HydratedAction, _context: MachineContext<HydratedOathGameState>): string {
        throw Error(CHRONICLE_BEING_WRITTEN)
    }
}
