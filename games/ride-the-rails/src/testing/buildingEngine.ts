import {
    ActionSource,
    GameEngine,
    MachineContext,
    type GameAction,
    type HydratedAction,
    type MachineStateHandler
} from '@tabletop/common'
import { HydratedEndBuilding, isEndBuilding } from '../actions/endBuilding.js'
import {
    HydratedFinishBuilding,
    isFinishBuilding,
    scheduleFinishBuilding
} from '../actions/finishBuilding.js'
import { HydratedPlaceLocomotive, isPlaceLocomotive } from '../actions/placeLocomotive.js'
import { RideTheRailsRuntime } from '../definition/runtime.js'
import { RideTheRailsStateHandlers } from '../definition/stateHandlers.js'
import { MachineState } from '../definition/states.js'
import { HydratedRideTheRailsGameState, type RideTheRailsGameState } from '../model/gameState.js'
import { createGame } from './fixtures.js'

// Stands in for the Building state's handler so a spec can run the engine through one building
// turn: it accepts the turn's actions and, on entry, schedules FinishBuilding when it is due.
class BuildingTurnHandler implements MachineStateHandler<
    HydratedAction,
    HydratedRideTheRailsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): boolean {
        if (action instanceof HydratedPlaceLocomotive) {
            return action.verdict(context.gameState).legal
        }
        return action instanceof HydratedEndBuilding || action instanceof HydratedFinishBuilding
    }

    validActionsForPlayer(): string[] {
        return []
    }

    enter(context: MachineContext<HydratedRideTheRailsGameState>) {
        const turn = context.gameState.turnManager.currentTurn()
        if (turn) {
            scheduleFinishBuilding(context, turn.playerId)
        }
    }

    onAction(): MachineState {
        return MachineState.Building
    }
}

export const buildingEngine = new GameEngine({
    ...RideTheRailsRuntime,
    stateHandlers: {
        ...RideTheRailsStateHandlers,
        [MachineState.Building]: new BuildingTurnHandler()
    }
})

export type BuildingRun = {
    before: RideTheRailsGameState
    after: RideTheRailsGameState
    processed: GameAction[]
}

export function runBuildingAction(
    state: HydratedRideTheRailsGameState,
    fields: Omit<GameAction, 'id' | 'gameId' | 'source'> & Record<string, unknown>
): BuildingRun {
    const before = state.dehydrate()
    const action = {
        id: `a${before.actionCount}`,
        gameId: before.gameId,
        source: ActionSource.User,
        ...fields
    }
    const result = buildingEngine.executeCanonicalAction({
        game: createGame(state.players.length),
        state: before,
        action
    })
    return { before, after: result.updatedState, processed: result.processedActions }
}

export function undoAll(run: BuildingRun): RideTheRailsGameState {
    return run.processed
        .toReversed()
        .reduce((state, action) => buildingEngine.undoProcessedAction({ state, action }), run.after)
}

export function hydrated(state: RideTheRailsGameState): HydratedRideTheRailsGameState {
    return new HydratedRideTheRailsGameState(structuredClone(state))
}

export function metadataOf(action: GameAction | undefined): unknown {
    if (isPlaceLocomotive(action) || isEndBuilding(action) || isFinishBuilding(action)) {
        return action.metadata
    }
    return undefined
}
