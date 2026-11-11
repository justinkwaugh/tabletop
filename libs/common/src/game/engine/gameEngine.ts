import { normalizeGame } from '../model/gameConfig.js'
import type { GameCreationOptions } from '../../util/gameSeeds.js'
import {
    validateStartingPositionAssignment,
    type StartingPositionAssignment
} from '../model/startingPositionAssignment.js'
import { getGameVisibility } from '../visibility/gameVisibility.js'
import {
    assertContinuationAllowed,
    GameContinuationError,
    type GameContinuation
} from './gameContinuation.js'
import { deriveGameSeeds, generateMasterSeed, normalizeMasterSeed } from '../../util/gameSeeds.js'
import jsonpatch from 'fast-json-patch'
import { GameAction, type HydratedAction, Patch, withoutActionPatches } from './gameAction.js'
import { createPatch } from './statePatch.js'
import {
    isOutOfTurnActionType,
    isOutOfTurnDeclaration,
    isSequencedActionType
} from './actionHistory.js'
import { Game, GameStatus } from '../model/game.js'
import {
    GameState,
    type HydratedGameState,
    type UninitializedGameState
} from '../model/gameState.js'
import { MachineContext } from './machineContext.js'
import type { MachineStateHandler } from './machineStateHandler.js'
import type { GameRuntime } from '../definition/gameDefinition.js'
import { reportGameProgress } from '../definition/gameProgression.js'
import { undoRecordedAction } from './recordedHistory.js'
import { nanoid } from 'nanoid'
import { generateSeed } from '../../util/prng.js'
import { assert, assertExists } from '../../util/assertions.js'
import type { Perspective } from '../visibility/valueProjector.js'
import { isRedactedAction, UnavailableProjectedActionError } from '../visibility/actionProjector.js'
import { applyCallGame, CALL_GAME_ACTION_TYPE } from './callGame.js'
import { calculateActionChecksum } from '../../util/checksum.js'

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

export interface GameStartOptions<T extends GameState = GameState> extends Omit<
    GameCreationOptions,
    'continueFromGameId'
> {
    startingPositions?: StartingPositionAssignment
    continuation?: GameContinuation<T>
}

export interface ActionAvailabilityOptions {
    readonly perspective?: Perspective
}

export type ActionInput<T extends GameState = GameState> = {
    action: GameAction
    state: T
    game: Game
    perspective?: Perspective
}

type PendingActionCheck<U extends HydratedGameState> = {
    hydratedState: U
    machineContext: MachineContext<U>
    perspective: Perspective | undefined
    game: Game
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

    startGame(
        game: Game,
        options: GameStartOptions<T> | string = {}
    ): { startedGame: Game; initialState: T } {
        game = normalizeGame(game, this.runtime.configuration)
        const {
            masterSeed,
            startingPositions: assignment,
            continuation
        }: GameStartOptions<T> = typeof options === 'string' ? { masterSeed: options } : options
        if (game.startedAt !== null && game.startedAt !== undefined) {
            throw Error('Game is already started')
        }
        let validContinuation: GameContinuation<T> | undefined
        if (game.continuedFromGameId !== undefined || continuation !== undefined) {
            assertExists(
                game.continuedFromGameId,
                'Only a continued game has a previous game state'
            )
            assertExists(continuation, 'A continued game starts from its previous game state')
            validContinuation = this.validateContinuation(game.continuedFromGameId, continuation)
        }

        const initializer = this.runtime.initializer
        if (assignment !== undefined) {
            assert(
                initializer.supportsStartingPositions === true,
                'This initializer does not support assigned starting positions'
            )
            validateStartingPositionAssignment(
                game.players.map((player) => player.id),
                assignment
            )
        }

        const startedGame = structuredClone(game)
        startedGame.startedAt = new Date()
        startedGame.status = GameStatus.Started
        delete startedGame.protectedInformation
        if (this.runtime.visibility !== undefined) startedGame.protectedInformation = true

        const uninitializedState = this.generateUninitializedState(game, masterSeed)
        startedGame.seed = uninitializedState.prng.seed
        const seededGame = { ...game, seed: startedGame.seed }
        const initialState = initializer.initializeGameState(
            seededGame,
            uninitializedState,
            assignment,
            validContinuation
        )

        const machineContext = new MachineContext({
            gameConfig: game.config,
            gameState: initialState
        })

        const initialHandler = this.getStateHandler(initialState)
        initialHandler.enter(machineContext)

        const state = initialState.dehydrate()
        this.validateCanonicalState(state)
        startedGame.progress = reportGameProgress(this.runtime, state)
        return { startedGame, initialState: state }
    }

    validateContinuation(
        sourceGameId: string,
        continuation: GameContinuation<T>
    ): GameContinuation<T> {
        assertContinuationAllowed(
            this.runtime.initializer.supportsContinuation === true,
            'This Game Title does not support continuation'
        )
        const previousState = this.canonicalContinuationState(continuation.previousState)
        assertContinuationAllowed(
            previousState.result !== undefined && previousState.canContinue === true,
            'The game being continued is not ready to continue'
        )
        assertContinuationAllowed(
            previousState.gameId === sourceGameId,
            'Continuation source does not match'
        )
        return { previousState, previousPlayers: structuredClone(continuation.previousPlayers) }
    }

    private canonicalContinuationState(state: Readonly<T>): T {
        try {
            const canonical = this.runtime.hydrator.hydrateState(structuredClone(state)).dehydrate()
            this.validateCanonicalState(canonical)
            return canonical
        } catch (error) {
            throw new GameContinuationError(
                'This version of the game can no longer continue from the finished game',
                error instanceof Error ? error : undefined
            )
        }
    }

    getValidActionTypesForPlayer(
        game: Game,
        state: T,
        playerId: string,
        options: ActionAvailabilityOptions = {}
    ): string[] {
        game = normalizeGame(game, this.runtime.configuration)
        const perspective = options.perspective
        if (
            state.result !== undefined ||
            (perspective !== undefined &&
                (perspective.kind !== 'player' || perspective.playerId !== playerId))
        ) {
            return []
        }

        const hydratedState = this.runtime.hydrator.hydrateState(state)
        const runtimeState = this.guardStateForPerspective(hydratedState, perspective, game)
        const machineContext = new MachineContext({
            gameConfig: game.config,
            gameState: runtimeState
        })

        const stateHandler = this.getStateHandler(runtimeState)
        const types = stateHandler.validActionsForPlayer(playerId, machineContext)
        return runtimeState.isActivePlayer(playerId)
            ? types
            : types.filter((type) => isOutOfTurnActionType(this.runtime.apiActions, type))
    }

    executeAction(input: ActionInput<T>): ActionCascadeResult<T> {
        return this.executeUnprocessedAction(input, false)
    }

    execute({ perspective, ...input }: ActionInput<T>): ActionCascadeResult<T> {
        return perspective === undefined
            ? this.executeCanonicalAction(input)
            : this.executeAction({ ...input, perspective })
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
            action: withoutActionPatches(action),
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

    accepts({ action, state, game, perspective }: ActionInput<T>): boolean {
        game = normalizeGame(game, this.runtime.configuration)
        if (
            isRedactedAction(action) ||
            action.type === CALL_GAME_ACTION_TYPE ||
            this.markerRejection(action)
        )
            return false
        const hydratedState = this.runtime.hydrator.hydrateState(structuredClone(state))
        const machineContext = new MachineContext({
            action,
            gameConfig: game.config,
            gameState: this.guardStateForPerspective(hydratedState, perspective, game)
        })
        const check = { hydratedState, machineContext, perspective, game }
        return (
            !this.pendingActionRejection(action, check) &&
            !this.invalidActionRejection(
                this.runtime.hydrator.hydrateAction(structuredClone(action)),
                check
            )
        )
    }

    /**
     * Re-applies a standing declaration after Undo reversed a suffix containing it (ADR 0007). It is
     * dropped where the restored position rejects it, and where it would act at once, since its
     * acting is a turn of its own.
     */
    reapplyDeclaration(input: ActionInput<T>): ActionCascadeResult<T> | undefined {
        if (!this.accepts(input)) return undefined
        const result = this.execute(input)
        return result.processedActions.length === 1 ? result : undefined
    }

    undoProcessedAction({ action, state }: { action: GameAction; state: T }): T {
        return undoRecordedAction(state, action)
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
        game = normalizeGame(game, this.runtime.configuration)
        if (isRedactedAction(action)) {
            throw Error('Redacted Action records cannot be executed by game rules')
        }

        if (canonical) this.validateCanonicalState(state)
        assert(state.result === undefined, 'A Game State with a result accepts no further Actions')
        if (action.type === CALL_GAME_ACTION_TYPE)
            return this.executeCallGame(action, state, canonical)

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

        const markerRejection = this.markerRejection(action)
        if (markerRejection) throw markerRejection

        const indexOffset =
            action.index !== undefined && action.index !== hydratedState.actionCount
                ? hydratedState.actionCount - action.index
                : 0

        if (indexOffset !== 0 && !action.simultaneousGroupId && !isOutOfTurnDeclaration(action)) {
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

            const check = { hydratedState, machineContext, perspective, game }
            const rejection = this.pendingActionRejection(currentAction, check)
            if (rejection) throw rejection

            const hydratedAction = this.runtime.hydrator.hydrateAction(
                structuredClone(currentAction)
            )
            if (!hydratedAction.createdAt) {
                hydratedAction.createdAt = new Date()
            }

            const invalid = this.invalidActionRejection(hydratedAction, check)
            if (invalid) throw invalid
            const stateHandler = this.getStateHandler(hydratedState)

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

            const undoPatch: Patch = createPatch(updatedState, stateBeforeAction)

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

    private executeCallGame(action: GameAction, state: T, canonical: boolean): RuntimeExecution<T> {
        assert(
            action.index === undefined || action.index === state.actionCount,
            `Action index is not valid, expected ${state.actionCount}, got ${action.index}`
        )
        const recorded = structuredClone(action)
        recorded.index = state.actionCount
        recorded.createdAt ??= new Date()
        const updatedState = applyCallGame(state, recorded)
        updatedState.actionCount = state.actionCount + 1
        updatedState.actionChecksum = calculateActionChecksum(state.actionChecksum, [recorded])
        if (canonical) this.validateCanonicalState(updatedState)
        recorded.undoPatch = createPatch(updatedState, state)
        return {
            processedActions: [recorded],
            updatedState,
            indexOffset: 0,
            before: state,
            transitions: [{ action: recorded, after: updatedState }]
        }
    }

    private guardStateForPerspective(
        state: U,
        perspective: Perspective | undefined,
        game: Game
    ): U {
        const visibility = getGameVisibility(game, this.runtime)
        return perspective !== undefined && visibility !== undefined
            ? visibility.state.guardForExecution(state, perspective, { config: game.config })
            : state
    }

    private markerRejection(action: GameAction): Error | undefined {
        if (action.outOfTurn && !isOutOfTurnActionType(this.runtime.apiActions, action.type))
            return new Error(`Action of type ${action.type} is not an out-of-turn Action`)
        if (action.sequenced && !isSequencedActionType(this.runtime.apiActions, action.type))
            return new Error(`Action of type ${action.type} is not a sequenced out-of-turn Action`)
        return undefined
    }

    private pendingActionRejection(
        action: GameAction,
        { hydratedState, perspective, game }: PendingActionCheck<U>
    ): Error | undefined {
        if (hydratedState.result !== undefined)
            return new Error('A Game State with a result accepts no further Actions')
        if (!this.isPlayerAllowed(action, hydratedState))
            return new Error(`Player ${action.playerId} is not an active player`)
        if (!this.isAvailableToPerspective(action, perspective, game))
            return new UnavailableProjectedActionError(action.type)
        return undefined
    }

    private invalidActionRejection(
        hydratedAction: HydratedAction,
        { hydratedState, machineContext }: PendingActionCheck<U>
    ): Error | undefined {
        return this.getStateHandler(hydratedState).isValidAction(hydratedAction, machineContext)
            ? undefined
            : new Error(
                  `Action of type ${hydratedAction.type} is not valid in state ${hydratedState.machineState}`
              )
    }

    private isAvailableToPerspective(
        action: GameAction,
        perspective: Perspective | undefined,
        game: Game
    ): boolean {
        const visibility = getGameVisibility(game, this.runtime)
        if (perspective === undefined || visibility === undefined) return true
        const projected = visibility.actions.project(action, perspective, { config: game.config })
        return !isRedactedAction(projected)
    }

    private sanitizeUnprocessedAction(action: GameAction): GameAction {
        const sanitizedAction = withoutActionPatches(action)
        Reflect.deleteProperty(sanitizedAction, 'metadata')
        return sanitizedAction
    }

    private applyStatePatch(state: T, patch: Patch): T {
        return jsonpatch.applyPatch(structuredClone(state), patch).newDocument
    }

    private isPlayerAllowed(action: GameAction, state: HydratedGameState): boolean {
        return (
            !action.playerId || action.outOfTurn === true || state.isActivePlayer(action.playerId)
        )
    }

    private getStateHandler(state: GameState): MachineStateHandler<HydratedAction, U> {
        const stateHandler = this.runtime.stateHandlers[state.machineState]
        assertExists(stateHandler, `Unknown machine state: ${state.machineState}`)
        return stateHandler
    }
}
