import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    StartOperatingSet,
    isStartOperatingSet,
    type HydratedStartOperatingSet
} from './startOperatingSet.js'
import type { OperatingState } from './operatingSet.js'

type State = HydratedGameState & OperatingState
export class StartOperatingSetHandler implements MachineStateHandler<
    HydratedStartOperatingSet,
    State
> {
    constructor(private readonly nextState: string) {}
    isValidAction(action: HydratedAction): boolean {
        return action.source === ActionSource.System && isStartOperatingSet(action)
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<State>): void {
        context.addSystemAction(StartOperatingSet, {
            playerId: context.gameState.activePlayerIds[0]
        })
    }
    onAction(): string {
        return this.nextState
    }
}
