import { type HydratedAction } from './gameAction.js'
import { MachineContext } from './machineContext.js'

export interface MachineStateHandler<T extends HydratedAction> {
    isValidAction(action: HydratedAction, context: MachineContext): boolean
    validActionsForPlayer(playerId: string, context: MachineContext): string[]
    enter(context: MachineContext): void
    onAction(action: T, context: MachineContext): string
}

export class TerminalStateHandler implements MachineStateHandler<HydratedAction> {
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
