import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import {
    HydratedTakeDevelopmentCash,
    isTakeDevelopmentCash
} from '../actions/takeDevelopmentCash.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { finishTurnAction } from './flow.js'

const MARKERS_PER_ACTION = 2

type DevelopingAction = HydratedDevelop | HydratedTakeDevelopmentCash

export class DevelopingTownsStateHandler implements MachineStateHandler<
    DevelopingAction,
    HydratedHcgGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): action is DevelopingAction {
        return isDevelop(action) || isTakeDevelopmentCash(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        const state = context.gameState
        if (state.turnPlayerId() !== playerId) {
            return []
        }
        const available: [ActionType, boolean][] = [
            [ActionType.Develop, HydratedDevelop.canDevelop(state)],
            [ActionType.TakeDevelopmentCash, HydratedTakeDevelopmentCash.canTake(state)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedHcgGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        action: DevelopingAction,
        context: MachineContext<HydratedHcgGameState>
    ): MachineState {
        const state = context.gameState
        const done =
            isTakeDevelopmentCash(action) || state.turnDevelopments.length >= MARKERS_PER_ACTION
        return done ? finishTurnAction(state) : MachineState.DevelopingTowns
    }
}
