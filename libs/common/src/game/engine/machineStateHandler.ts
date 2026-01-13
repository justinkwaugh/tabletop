import { type HydratedAction } from './gameAction.js'
import { MachineContext } from './machineContext.js'
import type { HydratedGameState } from '../model/gameState.js'

export interface MachineStateHandler<
    Action extends HydratedAction,
    State extends HydratedGameState = HydratedGameState
> {
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[]
    enter(context: MachineContext<State>): void
    onAction(action: Action, context: MachineContext<State>): string
}

export class TerminalStateHandler
    implements MachineStateHandler<HydratedAction, HydratedGameState>
{
    isValidAction(_action: HydratedAction, _context: MachineContext): boolean {
        return false
    }
    validActionsForPlayer(_playerId: string, _context: MachineContext): string[] {
        return []
    }
    enter(_context: MachineContext): void {}
    onAction(_action: unknown, _context: MachineContext): string {
        throw Error('Null State Handler cannot do anything')
    }
}
