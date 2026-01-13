import jsonpatch, { type Operation } from 'fast-json-patch'
import { GameAction, type HydratedAction, Patch } from './gameAction.js'
import { Game, GameStatus } from '../model/game.js'
import {
    GameState,
    type HydratedGameState,
    type UninitializedGameState
} from '../model/gameState.js'
import { MachineContext } from './machineContext.js'
import { type MachineStateHandler } from './machineStateHandler.js'
import { type GameDefinition } from '../definition/gameDefinition.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import { nanoid } from 'nanoid'
import { generateSeed } from '../../util/prng.js'
import { assert, assertExists } from '../../util/assertions.js'

export type ActionResult<T extends GameState = GameState> = {
    processedActions: GameAction[]
    updatedState: T
    indexOffset: number
}

export enum RunMode {
    Single = 'single',
    Multiple = 'multiple'
}

export class GameEngine<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> {
    constructor(public readonly definition: GameDefinition<T, U>) {}

    generateUninitializedState(game: Game): UninitializedGameState {
        const seed = game.seed ?? generateSeed()
        return {
            systemVersion: 2,
            id: nanoid(),
            gameId: game.id,
            seed,
            prng: { seed, invocations: 0 },
            activePlayerIds: [],
            winningPlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            result: undefined
        }
    }

    startGame(game: Game): { startedGame: Game; initialState: T } {
        if (game.startedAt !== null && game.startedAt !== undefined) {
            throw Error('Game is already started')
        }

        const startedGame = structuredClone(game)
        startedGame.startedAt = new Date()
        startedGame.status = GameStatus.Started

        const uninitializedState = this.generateUninitializedState(game)
        const initialState = this.definition.initializer.initializeGameState(
            game,
            uninitializedState
        )

        const machineContext = new MachineContext({
            gameConfig: game.config,
            gameState: initialState
        })

        const initialHandler = this.getStateHandler(initialState)
        initialHandler.enter(machineContext)

        return { startedGame, initialState: initialState.dehydrate() }
    }

    getValidActionTypesForPlayer(game: Game, state: T, playerId: string): string[] {
        const hydratedState = this.definition.hydrator.hydrateState(state)
        if (!hydratedState.isActivePlayer(playerId)) {
            return []
        }

        const machineContext = new MachineContext({
            gameConfig: game.config,
            gameState: hydratedState
        })

        const stateHandler = this.getStateHandler(hydratedState)
        return stateHandler.validActionsForPlayer(playerId, machineContext)
    }

    run(
        action: GameAction,
        state: T,
        game: Game,
        mode: RunMode = RunMode.Multiple
    ): ActionResult<T> {
        const processedActions: GameAction[] = []
        let updatedState = structuredClone(state)

        const hydratedState = this.definition.hydrator.hydrateState(updatedState)
        const machineContext = new MachineContext({
            action: action,
            gameConfig: game.config,
            gameState: hydratedState
        })

        // Simultaneous actions can cause this, otherwise it's bad data
        const indexOffset =
            action.index && action.index !== hydratedState.actionCount
                ? hydratedState.actionCount - action.index
                : 0

        if (indexOffset !== 0 && !action.simultaneousGroupId) {
            throw Error(
                `Action index is not valid, expected ${hydratedState.actionCount}, got ${action.index}`
            )
        }

        while (
            machineContext.getPendingActions().length > 0 &&
            (mode === RunMode.Multiple || processedActions.length === 0)
        ) {
            const currentAction = machineContext.nextPendingAction()
            assertExists(currentAction, 'Action to process was unexpectedly null')

            assert(
                this.isPlayerAllowed(currentAction, hydratedState),
                `Player ${currentAction.playerId} is not an active player`
            )

            const hydratedAction = this.definition.hydrator.hydrateAction(
                structuredClone(currentAction)
            )
            if (!hydratedAction.createdAt) {
                hydratedAction.createdAt = new Date()
            }

            const stateHandler = this.getStateHandler(hydratedState)
            assert(
                stateHandler.isValidAction(hydratedAction, machineContext),
                `Action of type ${hydratedAction.type} is not valid in state ${hydratedState.machineState}`
            )

            hydratedAction.apply(hydratedState, machineContext)

            const nextMachineState = stateHandler.onAction(hydratedAction, machineContext)

            hydratedState.recordAction(hydratedAction)
            hydratedState.machineState = nextMachineState

            const nextHandler = this.getStateHandler(hydratedState)
            nextHandler.enter(machineContext)

            const stateBeforeAction = updatedState
            updatedState = hydratedState.dehydrate()

            if (
                updatedState.explorationState &&
                updatedState.actionCount === updatedState.explorationState.actionCount
            ) {
                updatedState.prng.invocations = updatedState.explorationState.invocations
            }

            const undoPatch = jsonpatch.compare(updatedState, stateBeforeAction)

            const dehydratedAction = hydratedAction.dehydrate()
            dehydratedAction.undoPatch = undoPatch as Patch

            processedActions.push(dehydratedAction)
        }

        return { processedActions, updatedState, indexOffset }
    }

    undoAction(state: T, action: GameAction): T {
        const stateCopy = structuredClone(state)
        const initialChecksum = state.actionChecksum
        const undoPatch = action.undoPatch
        assertExists(undoPatch, 'Action has no undo patch')

        jsonpatch.applyPatch(stateCopy, undoPatch as Operation[])
        if (stateCopy.actionChecksum === initialChecksum) {
            console.log('Undoing an old action, calculating checksum manually')
            // This is only for games created when undo was not a thing
            stateCopy.actionChecksum = calculateActionChecksum(stateCopy.actionChecksum, [action])
        }
        return stateCopy
    }

    private isPlayerAllowed(action: GameAction, state: HydratedGameState): boolean {
        return !action.playerId || state.isActivePlayer(action.playerId)
    }

    private getStateHandler(state: GameState): MachineStateHandler<HydratedAction, U> {
        const stateHandler = this.definition.stateHandlers[state.machineState]
        assertExists(stateHandler, `Unknown machine state: ${state.machineState}`)
        return stateHandler
    }
}
