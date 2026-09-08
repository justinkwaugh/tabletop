import { getGameVisibility } from '../visibility/gameVisibility.js'
import { deriveGameSeeds, generateMasterSeed, normalizeMasterSeed } from '../../util/gameSeeds.js'
import jsonpatch from 'fast-json-patch'
import { GameAction, type HydratedAction, Patch } from './gameAction.js'
import { Game, GameStatus } from '../model/game.js'
import {
    GameState,
    type HydratedGameState,
    type UninitializedGameState
} from '../model/gameState.js'
import { MachineContext } from './machineContext.js'
import { type MachineStateHandler } from './machineStateHandler.js'
import { type GameRuntime } from '../definition/gameDefinition.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import { nanoid } from 'nanoid'
import { generateSeed } from '../../util/prng.js'
import { assert, assertExists } from '../../util/assertions.js'
import type { Perspective } from '../visibility/valueProjector.js'
import { isRedactedAction, UnavailableProjectedActionError } from '../visibility/actionProjector.js'

export type ActionResult<T extends GameState = GameState> = {
    processedActions: GameAction[]
    updatedState: T
    indexOffset: number
}

export interface CanonicalActionTransition<T extends GameState = GameState> {
    readonly action: GameAction
    readonly after: T
}

export interface CanonicalActionCascade<T extends GameState = GameState> {
    readonly before: T
    readonly transitions: readonly CanonicalActionTransition<T>[]
}

export type ActionCascadeResult<T extends GameState = GameState> = ActionResult<T> & {
    actionCascade: CanonicalActionCascade<T>
}

export interface ActionAvailabilityOptions {
    readonly perspective?: Perspective
}

interface RuntimeExecution<T extends GameState> extends ActionResult<T> {
    readonly before: T
    readonly transitions: readonly CanonicalActionTransition<T>[]
}

export class GameEngine<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> {
    constructor(public readonly runtime: GameRuntime<T, U>) {}

    validateCanonicalState(state: T): void {
        const validator = this.runtime.canonicalStateValidator
        if (validator === undefined) {
            this.runtime.hydrator.hydrateState(state)
            return
        }
        assert(validator.Check(state), 'Complete canonical state is required')
    }

    executeCanonicalAction(input: {
        action: GameAction
        state: T
        game: Game
    }): ActionCascadeResult<T> {
        return this.executeUnprocessedAction(input, true)
    }

    generateUninitializedState(game: Game, suppliedMasterSeed?: string): UninitializedGameState {
        const masterSeed =
            this.runtime.randomnessVersion === 1
                ? normalizeMasterSeed(suppliedMasterSeed ?? generateMasterSeed())
                : undefined
        assert(
            suppliedMasterSeed === undefined || masterSeed !== undefined,
            'This runtime does not support reproduction seeds'
        )
        const derived = masterSeed === undefined ? undefined : deriveGameSeeds(masterSeed)
        const seed = derived?.publicSeed ?? game.seed ?? generateSeed()
        return {
            systemVersion: 3,
            id: nanoid(),
            gameId: game.id,
            seed,
            prng: { seed, invocations: 0 },
            protectedPrng:
                derived === undefined
                    ? { seed: generateSeed(), invocations: 0 }
                    : { algorithm: 'chacha20-v1', seed: derived.protectedSeed, invocations: 0 },
            ...(masterSeed === undefined ? {} : { masterSeed }),
            activePlayerIds: [],
            winningPlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            result: undefined
        }
    }

    startGame(game: Game, masterSeed?: string): { startedGame: Game; initialState: T } {
        if (game.startedAt !== null && game.startedAt !== undefined) {
            throw Error('Game is already started')
        }

        const startedGame = structuredClone(game)
        startedGame.startedAt = new Date()
        startedGame.status = GameStatus.Started
        delete startedGame.protectedInformation
        if (this.runtime.visibility !== undefined) startedGame.protectedInformation = true

        const uninitializedState = this.generateUninitializedState(game, masterSeed)
        startedGame.seed = uninitializedState.prng.seed
        const initialState = this.runtime.initializer.initializeGameState(
            { ...game, seed: startedGame.seed },
            uninitializedState
        )

        const machineContext = new MachineContext({
            gameConfig: game.config,
            gameState: initialState
        })

        const initialHandler = this.getStateHandler(initialState)
        initialHandler.enter(machineContext)

        const state = initialState.dehydrate()
        this.validateCanonicalState(state)
        return { startedGame, initialState: state }
    }

    getValidActionTypesForPlayer(
        game: Game,
        state: T,
        playerId: string,
        options: ActionAvailabilityOptions = {}
    ): string[] {
        const perspective = options.perspective
        if (
            perspective !== undefined &&
            (perspective.kind !== 'player' || perspective.playerId !== playerId)
        ) {
            return []
        }

        const hydratedState = this.runtime.hydrator.hydrateState(state)
        const runtimeState = this.guardStateForPerspective(hydratedState, perspective, game)
        if (!runtimeState.isActivePlayer(playerId)) {
            return []
        }

        const machineContext = new MachineContext({
            gameConfig: game.config,
            gameState: runtimeState
        })

        const stateHandler = this.getStateHandler(runtimeState)
        return stateHandler.validActionsForPlayer(playerId, machineContext)
    }

    executeAction(input: {
        action: GameAction
        state: T
        game: Game
        perspective?: Perspective
    }): ActionCascadeResult<T> {
        return this.executeUnprocessedAction(input, false)
    }

    private executeUnprocessedAction(
        {
            action,
            state,
            game,
            perspective
        }: {
            action: GameAction
            state: T
            game: Game
            perspective?: Perspective
        },
        canonical: boolean
    ): ActionCascadeResult<T> {
        const execution = this.executeThroughRuntime({
            action: this.sanitizeUnprocessedAction(action),
            state,
            game,
            processGeneratedActions: true,
            canonical,
            perspective
        })

        return {
            processedActions: execution.processedActions,
            updatedState: execution.updatedState,
            indexOffset: execution.indexOffset,
            actionCascade: {
                before: execution.before,
                transitions: execution.transitions
            }
        }
    }

    applyProcessedAction({ action, state, game }: { action: GameAction; state: T; game: Game }): T {
        if (isRedactedAction(action)) {
            assertExists(action.forwardPatch, 'Redacted Action record requires a forward patch')
            return this.applyStatePatch(state, action.forwardPatch)
        }
        if (action.forwardPatch !== undefined) {
            return this.applyStatePatch(state, action.forwardPatch)
        }

        return this.executeThroughRuntime({
            action,
            state,
            game,
            processGeneratedActions: false
        }).updatedState
    }

    executeSingleAction({
        action,
        state,
        game
    }: {
        action: GameAction
        state: T
        game: Game
    }): ActionResult<T> {
        const execution = this.executeThroughRuntime({
            action: this.cloneWithoutActionPatches(action),
            state,
            game,
            processGeneratedActions: false
        })

        return {
            processedActions: execution.processedActions,
            updatedState: execution.updatedState,
            indexOffset: execution.indexOffset
        }
    }

    undoProcessedAction({ action, state }: { action: GameAction; state: T }): T {
        const initialChecksum = state.actionChecksum
        const undoPatch = action.undoPatch
        assertExists(undoPatch, 'Action has no undo patch')

        const updatedState = this.applyStatePatch(state, undoPatch)
        if (updatedState.actionChecksum === initialChecksum) {
            console.log('Undoing an old action, calculating checksum manually')
            // This is only for games created when undo was not a thing
            updatedState.actionChecksum = calculateActionChecksum(updatedState.actionChecksum, [
                action
            ])
        }
        return updatedState
    }

    private executeThroughRuntime({
        action,
        state,
        game,
        processGeneratedActions,
        perspective,
        canonical = false
    }: {
        action: GameAction
        state: T
        game: Game
        processGeneratedActions: boolean
        perspective?: Perspective
        canonical?: boolean
    }): RuntimeExecution<T> {
        if (isRedactedAction(action)) {
            throw Error('Redacted Action records cannot be executed by game rules')
        }

        if (canonical) this.validateCanonicalState(state)

        const processedActions: GameAction[] = []
        const transitions: CanonicalActionTransition<T>[] = []
        let updatedState = structuredClone(state)
        const before = updatedState

        const hydratedState = this.runtime.hydrator.hydrateState(updatedState)
        const runtimeState = this.guardStateForPerspective(hydratedState, perspective, game)
        const machineContext = new MachineContext({
            action: action,
            gameConfig: game.config,
            gameState: runtimeState
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
            (processGeneratedActions || processedActions.length === 0)
        ) {
            const currentAction = machineContext.nextPendingAction()
            assertExists(currentAction, 'Action to process was unexpectedly null')

            assert(
                this.isPlayerAllowed(currentAction, hydratedState),
                `Player ${currentAction.playerId} is not an active player`
            )
            this.assertActionAvailableToPerspective(currentAction, perspective, game)

            const hydratedAction = this.runtime.hydrator.hydrateAction(
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

            hydratedAction.apply(runtimeState, machineContext)

            const nextMachineState = stateHandler.onAction(hydratedAction, machineContext)

            hydratedState.recordAction(hydratedAction)
            hydratedState.machineState = nextMachineState

            const nextHandler = this.getStateHandler(hydratedState)
            nextHandler.enter(machineContext)

            const stateBeforeAction = updatedState
            updatedState = hydratedState.dehydrate()

            if (
                updatedState.explorationState &&
                !updatedState.explorationState.checkpoint &&
                updatedState.actionCount === updatedState.explorationState.actionCount
            ) {
                updatedState.prng.invocations = updatedState.explorationState.invocations
            }

            if (canonical) this.validateCanonicalState(updatedState)

            const undoPatch: Patch = jsonpatch.compare(updatedState, stateBeforeAction)

            const dehydratedAction = hydratedAction.dehydrate()
            dehydratedAction.undoPatch = undoPatch

            processedActions.push(dehydratedAction)
            transitions.push({ action: dehydratedAction, after: updatedState })
        }

        return {
            processedActions,
            updatedState,
            indexOffset,
            before,
            transitions
        }
    }

    private guardStateForPerspective(
        state: U,
        perspective: Perspective | undefined,
        game: Game
    ): U {
        const visibility = getGameVisibility(game, this.runtime)
        return perspective !== undefined && visibility !== undefined
            ? visibility.state.guardForExecution(state, perspective)
            : state
    }

    private assertActionAvailableToPerspective(
        action: GameAction,
        perspective: Perspective | undefined,
        game: Game
    ): void {
        const visibility = getGameVisibility(game, this.runtime)
        if (perspective === undefined || visibility === undefined) {
            return
        }

        const projected = visibility.actions.project(action, perspective)
        if (isRedactedAction(projected)) {
            throw new UnavailableProjectedActionError(action.type)
        }
    }

    private sanitizeUnprocessedAction(action: GameAction): GameAction {
        const sanitizedAction = this.cloneWithoutActionPatches(action)
        Reflect.deleteProperty(sanitizedAction, 'metadata')
        return sanitizedAction
    }

    private cloneWithoutActionPatches(action: GameAction): GameAction {
        const actionWithoutPatches = structuredClone(action)
        delete actionWithoutPatches.undoPatch
        delete actionWithoutPatches.forwardPatch
        return actionWithoutPatches
    }

    private applyStatePatch(state: T, patch: Patch): T {
        return jsonpatch.applyPatch(structuredClone(state), patch).newDocument
    }

    private isPlayerAllowed(action: GameAction, state: HydratedGameState): boolean {
        return !action.playerId || state.isActivePlayer(action.playerId)
    }

    private getStateHandler(state: GameState): MachineStateHandler<HydratedAction, U> {
        const stateHandler = this.runtime.stateHandlers[state.machineState]
        assertExists(stateHandler, `Unknown machine state: ${state.machineState}`)
        return stateHandler
    }
}
