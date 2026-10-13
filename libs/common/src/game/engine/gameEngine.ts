import { normalizeGame } from '../model/gameConfig.js'
import type { GameCreationOptions } from '../../util/gameSeeds.js'
import {
    validateStartingPositionAssignment,
    type StartingPositionAssignment
} from '../model/startingPositionAssignment.js'
import { getGameVisibility } from '../visibility/gameVisibility.js'
import {
    deriveGameSeeds,
    deriveStartingPositionSeeds,
    generateMasterSeed,
    normalizeMasterSeed
} from '../../util/gameSeeds.js'
import jsonpatch from 'fast-json-patch'
import * as Value from 'typebox/value'
import type * as Type from 'typebox'
import { ActionSource, createAction, GameAction, type HydratedAction, Patch } from './gameAction.js'
import { createPatch } from './statePatch.js'
import { runs, sameRun, unprocessed } from './actionReplay.js'
import {
    branchFromView,
    BranchMergeError,
    branchUndoWindow,
    branchView,
    firstActionWithAnotherResult,
    sameBranchOutcome,
    unopenedBranchView,
    type Branch,
    type BranchExecution
} from './branch.js'
import { findBranchScopeViolation } from './branchScope.js'
import {
    BranchCloseActionType,
    spanRuns,
    isBranchClose,
    isRestingInSpan,
    restingSpan,
    spanAwaitingBranch,
    returnedPlayerIds,
    spanActivePlayerIds,
    unmergedPlayerIds
} from './parallelSpan.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import {
    isOutOfTurnActionType,
    isOutOfTurnDeclaration,
    isSequencedActionType
} from './actionHistory.js'
import { Game, GameStatus } from '../model/game.js'
import {
    GameState,
    type HydratedGameState,
    type ParallelSpanState,
    type StartingPositionRandomState,
    type UninitializedGameState
} from '../model/gameState.js'
import { Prng, type RandomState } from '../components/prng.js'
import { MachineContext } from './machineContext.js'
import { type MachineStateHandler } from './machineStateHandler.js'
import { type GameRuntime, type ParallelSpanDefinition } from '../definition/gameDefinition.js'
import { undoRecordedAction } from './recordedHistory.js'
import { nanoid } from 'nanoid'
import { generateSeed } from '../../util/prng.js'
import { assert, assertExists } from '../../util/assertions.js'
import { errorMessage } from '../../util/errors.js'
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

export interface GameStartOptions extends GameCreationOptions {
    startingPositions?: StartingPositionAssignment
}

export interface ActionAvailabilityOptions {
    readonly perspective?: Perspective
}

interface SpanStep {
    readonly branchPlayerId?: string
    readonly completing: boolean
}

const OUTSIDE_SPAN_STEP: SpanStep = { completing: false }

interface RuntimeExecution<T extends GameState> extends ActionResult<T> {
    readonly before: T
    readonly transitions: readonly CanonicalActionTransition<T>[]
}

export function combineCascades<T extends GameState>(
    before: T,
    steps: readonly ActionCascadeResult<T>[]
): ActionCascadeResult<T> {
    return {
        processedActions: steps.flatMap((step) => step.processedActions),
        updatedState: steps.at(-1)?.updatedState ?? before,
        indexOffset: 0,
        actionCascade: {
            before,
            transitions: steps.flatMap((step) => step.actionCascade.transitions)
        }
    }
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
            protectedPrng: this.secretStream(derived?.protectedSeed),
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
        options: GameStartOptions | string = {}
    ): { startedGame: Game; initialState: T } {
        game = normalizeGame(game, this.runtime.configuration)
        const { masterSeed, startingPositions: assignment } =
            typeof options === 'string' ? { masterSeed: options } : options
        if (game.startedAt !== null && game.startedAt !== undefined) {
            throw Error('Game is already started')
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
            assignment
        )

        if (this.runtime.parallelSpans !== undefined) {
            initialState.startingPositionRandom = this.generateStartingPositionRandom(
                initialState.turnManager.turnOrder,
                uninitializedState.masterSeed
            )
        }

        const machineContext = new MachineContext({
            gameConfig: game.config,
            gameState: initialState
        })

        this.enterMachineState(initialState, machineContext, OUTSIDE_SPAN_STEP)

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
        game = normalizeGame(game, this.runtime.configuration)
        const perspective = options.perspective
        if (
            perspective !== undefined &&
            (perspective.kind !== 'player' || perspective.playerId !== playerId)
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

    advanceSpan({ state, game }: { state: T; game: Game }): ActionCascadeResult<T> | undefined {
        const steps: ActionCascadeResult<T>[] = []
        let current = state
        while (isRestingInSpan(current)) {
            const span = restingSpan(current)
            const returnedPlayerId = returnedPlayerIds(span).at(0)
            const nextPlayerId = unmergedPlayerIds(span).at(0)
            const step =
                returnedPlayerId !== undefined
                    ? this.closeBranch({ state: current, playerId: returnedPlayerId })
                    : nextPlayerId === undefined
                      ? this.completeSpan({ state: current, game })
                      : this.startBranch({ state: current, game, playerId: nextPlayerId })
            steps.push(step)
            current = step.updatedState
        }
        return steps.length === 0 ? undefined : combineCascades(state, steps)
    }

    closeBranch({ state, playerId }: { state: T; playerId: string }): ActionCascadeResult<T> {
        const span = restingSpan(state)
        assert(span.playerIds.includes(playerId), `Player ${playerId} takes no part in this span`)
        const action: GameAction = {
            id: span.branchCloseIds[playerId],
            gameId: state.gameId,
            type: BranchCloseActionType,
            source: ActionSource.System,
            playerId,
            createdAt: new Date()
        }
        const updatedState = this.applyBranchClose(state, action)
        action.index = state.actionCount
        action.undoPatch = createPatch(updatedState, state)
        return {
            processedActions: [action],
            updatedState,
            indexOffset: 0,
            actionCascade: { before: state, transitions: [{ action, after: updatedState }] }
        }
    }

    private applyBranchClose(state: T, action: GameAction): T {
        const playerId = action.playerId
        assertExists(playerId, 'A Branch Close names its Player')
        const span = state.parallelSpan
        assertExists(span, 'No Parallel Span is in progress')
        assert(
            span.branchCloseIds[playerId] === action.id,
            `This is not the Branch Close of ${playerId} in this span`
        )
        assert(
            !span.closedPlayerIds.includes(playerId),
            `The Branch of ${playerId} is already closed`
        )
        const closed = { ...span, closedPlayerIds: [...span.closedPlayerIds, playerId] }
        return {
            ...structuredClone(state),
            parallelSpan: closed,
            activePlayerIds: spanActivePlayerIds(closed),
            actionCount: state.actionCount + 1,
            actionChecksum: calculateActionChecksum(state.actionChecksum, [
                { ...action, index: state.actionCount }
            ])
        }
    }

    startBranch({
        state,
        game,
        playerId
    }: {
        state: T
        game: Game
        playerId: string
    }): ActionCascadeResult<T> {
        const span = spanAwaitingBranch(state, playerId)
        return this.executeCanonicalAction({
            action: this.spanAction(state, this.spanDefinition(span).branchStart, {
                id: span.branchStartIds[playerId],
                playerId
            }),
            state,
            game
        })
    }

    completeSpan({ state, game }: { state: T; game: Game }): ActionCascadeResult<T> {
        const span = restingSpan(state)
        assert(
            unmergedPlayerIds(span).length === 0,
            'Span Completion needs every Branch on the Main Line'
        )
        assert(
            span.closedPlayerIds.length === span.playerIds.length,
            'Span Completion needs a Branch Close for every Branch'
        )
        return this.executeCanonicalAction({
            action: this.spanAction(state, this.spanDefinition(span).spanCompletion, {
                id: span.completionId
            }),
            state,
            game
        })
    }

    nextBranchToMerge({ state }: { state: T }): string | undefined {
        const span = restingSpan(state)
        const waiting = unmergedPlayerIds(span)
        const isClosed = (playerId: string) => span.closedPlayerIds.includes(playerId)
        const held = this.spanDefinition(span).merge === 'barrier' && !waiting.every(isClosed)
        return held ? undefined : waiting.slice(0, 1).find(isClosed)
    }

    createBranch({
        state,
        game,
        playerId
    }: {
        state: T
        game: Game
        playerId: string
    }): BranchExecution<T> {
        const started = this.startBranch({
            state: unopenedBranchView(state, playerId),
            game,
            playerId
        })
        return this.branchExecution(state, started, playerId)
    }

    executeBranchAction({
        state,
        branch,
        action,
        game
    }: {
        state: T
        branch: Branch
        action: GameAction
        game: Game
    }): BranchExecution<T> {
        assert(!branch.closed, `The Branch of ${branch.playerId} is closed`)
        const executed = this.executeCanonicalAction({
            action,
            state: branchView(state, branch),
            game
        })
        return this.branchExecution(state, executed, branch.playerId)
    }

    undoBranchAction({
        state,
        branch,
        actions,
        actionId,
        asAdministrator = false
    }: {
        state: T
        branch: Branch
        actions: readonly GameAction[]
        actionId: string
        asAdministrator?: boolean
    }): { branch: Branch; undoneActions: GameAction[] } {
        const playerId = branch.playerId
        const undoneActions = branchUndoWindow(playerId, actions, actionId, asAdministrator)
        assert(
            undoneActions.at(-1)?.index === branch.actionCount - 1,
            'The recorded Actions do not end where the Branch does'
        )
        let view = branchView(state, branch)
        for (const action of undoneActions.toReversed()) {
            view = this.undoProcessedAction({ action, state: view })
        }
        return { branch: branchFromView(state, view, playerId), undoneActions }
    }

    replayOnSpan({
        state,
        game,
        recorded
    }: {
        state: T
        game: Game
        recorded: readonly GameAction[]
    }): ActionCascadeResult<T> {
        const steps: ActionCascadeResult<T>[] = []
        let current = state
        for (const run of spanRuns(recorded, restingSpan(state))) {
            const playerId = run[0].playerId
            assertExists(playerId, 'Every step of a span belongs to a Player')
            const step = isBranchClose(run[0])
                ? this.closeBranch({ state: current, playerId })
                : this.replayOnMainLine({ state: current, game, playerId, recorded: run })
            steps.push(step)
            current = step.updatedState
        }
        return combineCascades(state, steps)
    }

    mergeBranch({
        state,
        game,
        branch,
        actions
    }: {
        state: T
        game: Game
        branch: Branch
        actions: readonly GameAction[]
    }): ActionCascadeResult<T> {
        const playerId = branch.playerId
        assert(branch.closed, `The Branch of ${playerId} is still open`)
        const span = restingSpan(state)
        assert(
            span.closedPlayerIds.includes(playerId),
            `The Branch of ${playerId} has no Branch Close on the Main Line`
        )
        assert(
            unmergedPlayerIds(span).at(0) === playerId,
            `The Branch of ${playerId} is not next in Merge Order`
        )
        const expected = branchView(state, branch)
        const recordedRuns = runs(actions)
        if (recordedRuns.at(0)?.at(0)?.id !== span.branchStartIds[playerId])
            throw new BranchMergeError(playerId, 'its record does not begin with its Branch Start')

        const steps: ActionCascadeResult<T>[] = []
        let current = state
        for (const recorded of recordedRuns) {
            const replayed = this.replayOnMainLine({ state: current, game, playerId, recorded })
            steps.push(replayed)
            current = replayed.updatedState
        }
        if (!sameBranchOutcome(current, expected))
            throw new BranchMergeError(
                playerId,
                'it reached a different Game State on the Main Line'
            )
        const merged = combineCascades(state, steps)
        const changed = firstActionWithAnotherResult({
            closedView: expected,
            recorded: actions,
            replayed: merged.actionCascade.transitions.map((transition) => transition.after)
        })
        if (changed !== undefined)
            throw new BranchMergeError(
                playerId,
                `${changed.type} had a different result on the Main Line`
            )
        return merged
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
        if (isBranchClose(action)) return this.applyBranchClose(state, action)
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

        assert(
            !action.outOfTurn || isOutOfTurnActionType(this.runtime.apiActions, action.type),
            `Action of type ${action.type} is not an out-of-turn Action`
        )
        assert(
            !action.sequenced || isSequencedActionType(this.runtime.apiActions, action.type),
            `Action of type ${action.type} is not a sequenced out-of-turn Action`
        )

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

            const spanStep = this.spanStepFor(currentAction, hydratedState)
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
            if (spanStep.completing) hydratedAction.revealsInfo = true

            const nextMachineState = stateHandler.onAction(hydratedAction, machineContext)

            hydratedState.recordAction(hydratedAction)
            hydratedState.machineState = nextMachineState

            this.enterMachineState(hydratedState, machineContext, spanStep)
            assert(
                spanStep.branchPlayerId === undefined ||
                    hydratedState.parallelSpan?.branchPlayerId !== undefined ||
                    machineContext.getPendingActions().length === 0,
                'A Branch must end its cascade when it closes'
            )

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
            this.assertWithinBranchScope(spanStep, undoPatch, stateBeforeAction, updatedState)

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

    private spanStepFor(action: GameAction, state: U): SpanStep {
        const span = state.parallelSpan
        if (span === undefined) return OUTSIDE_SPAN_STEP
        assert(action.outOfTurn !== true, 'Out-of-Turn Actions are rejected during a Parallel Span')
        if (span.branchPlayerId !== undefined) {
            return { branchPlayerId: span.branchPlayerId, completing: false }
        }
        assert(
            action.source === ActionSource.System,
            'No User Action is valid in a Branching Machine State'
        )
        const playerId = action.playerId
        if (playerId === undefined || span.branchStartIds[playerId] !== action.id) {
            return { completing: action.id === span.completionId }
        }
        assert(
            !span.mergedPlayerIds.includes(playerId),
            `The Branch of ${playerId} is already on the Main Line`
        )
        span.branchPlayerId = playerId
        state.activePlayerIds = [playerId]
        return { branchPlayerId: playerId, completing: false }
    }

    private enterMachineState(state: U, context: MachineContext<U>, spanStep: SpanStep): void {
        const handler = this.getStateHandler(state)
        const span = state.parallelSpan
        if (span === undefined) {
            handler.enter(context)
            const definition = this.runtime.parallelSpans?.[state.machineState]
            if (definition !== undefined) {
                state.parallelSpan = this.newSpan(state, definition)
                state.activePlayerIds = [...state.parallelSpan.playerIds]
            }
            return
        }

        const { branchPlayerId, completing } = spanStep
        const inBranchingMachineState = state.machineState === span.machineState
        if (branchPlayerId === undefined && !inBranchingMachineState) {
            assert(
                completing && unmergedPlayerIds(span).length === 0,
                'Only Span Completion may leave a Branching Machine State'
            )
            delete state.parallelSpan
            this.enterMachineState(state, context, OUTSIDE_SPAN_STEP)
            return
        }
        assert(!completing, 'Span Completion must leave the Branching Machine State')
        assert(
            branchPlayerId === undefined ||
                inBranchingMachineState ||
                this.runtime.parallelSpans?.[state.machineState] === undefined,
            'A Branch cannot enter another Branching Machine State'
        )

        handler.enter(context)

        if (branchPlayerId !== undefined && inBranchingMachineState) {
            span.mergedPlayerIds.push(branchPlayerId)
            delete span.branchPlayerId
        }
        state.activePlayerIds = spanActivePlayerIds(span)
    }

    private newSpan(state: U, definition: ParallelSpanDefinition<U>): ParallelSpanState {
        const identity = new Prng(state.prng)
        const mergeOrder = definition.mergeOrder(state)
        assert(
            state.activePlayerIds.every((playerId) => mergeOrder.includes(playerId)),
            'Merge Order must place every Active Player'
        )
        const playerIds = mergeOrder.filter((playerId) => state.isActivePlayer(playerId))
        const identityForEach = () =>
            Object.fromEntries(playerIds.map((playerId) => [playerId, identity.randId()]))
        return {
            machineState: state.machineState,
            branchPoint: {
                actionCount: state.actionCount,
                actionChecksum: state.actionChecksum
            },
            playerIds,
            closedPlayerIds: [],
            mergedPlayerIds: [],
            branchStartIds: identityForEach(),
            completionId: identity.randId(),
            branchCloseIds: identityForEach()
        }
    }

    private assertWithinBranchScope(
        spanStep: SpanStep,
        undoPatch: Patch,
        before: T,
        after: T
    ): void {
        const playerId = spanStep.branchPlayerId
        if (playerId === undefined) return
        const violation = findBranchScopeViolation({ undoPatch, before, after, playerId })
        assert(violation === undefined, `The Branch of ${playerId} may not change ${violation}`)
    }

    private spanDefinition(span: ParallelSpanState): ParallelSpanDefinition<U> {
        const definition = this.runtime.parallelSpans?.[span.machineState]
        assertExists(definition, `${span.machineState} is not a Branching Machine State`)
        return definition
    }

    private spanAction(
        state: T,
        schema: Type.TSchema,
        identity: { id: string; playerId?: string }
    ): GameAction {
        const action: unknown = createAction(schema, {
            ...identity,
            gameId: state.gameId,
            source: ActionSource.System,
            createdAt: new Date()
        })
        assert(Value.Check(GameAction, action), 'A span Action must be a Game Action')
        return action
    }

    private replayOnMainLine({
        state,
        game,
        playerId,
        recorded
    }: {
        state: T
        game: Game
        playerId: string
        recorded: readonly GameAction[]
    }): ActionCascadeResult<T> {
        const first = recorded[0]
        let replayed: ActionCascadeResult<T>
        try {
            replayed = this.executeCanonicalAction({ action: unprocessed(first), state, game })
        } catch (error) {
            throw new BranchMergeError(
                playerId,
                `${first.type} failed on the Main Line: ${errorMessage(error)}`
            )
        }
        const sameIdentities = recorded.every(
            (action, index) => action.id === replayed.processedActions.at(index)?.id
        )
        if (!sameRun(recorded, replayed.processedActions) || !sameIdentities)
            throw new BranchMergeError(playerId, `${first.type} ran differently on the Main Line`)
        return replayed
    }

    private branchExecution(
        state: T,
        executed: ActionCascadeResult<T>,
        playerId: string
    ): BranchExecution<T> {
        return {
            branch: branchFromView(state, executed.updatedState, playerId),
            processedActions: executed.processedActions,
            view: executed.updatedState
        }
    }

    private generateStartingPositionRandom(
        initialOrder: readonly string[],
        masterSeed: string | undefined
    ): StartingPositionRandomState[] {
        return initialOrder.map((playerId, startingPosition) => {
            const seeds =
                masterSeed === undefined
                    ? undefined
                    : deriveStartingPositionSeeds(masterSeed, startingPosition)
            return {
                playerId,
                identity: { seed: seeds?.identitySeed ?? generateSeed(), invocations: 0 },
                rules: this.secretStream(seeds?.rulesSeed)
            }
        })
    }

    private secretStream(derivedSeed: string | undefined): RandomState {
        return derivedSeed === undefined
            ? { seed: generateSeed(), invocations: 0 }
            : { algorithm: 'chacha20-v1', seed: derivedSeed, invocations: 0 }
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

    private assertActionAvailableToPerspective(
        action: GameAction,
        perspective: Perspective | undefined,
        game: Game
    ): void {
        const visibility = getGameVisibility(game, this.runtime)
        if (perspective === undefined || visibility === undefined) {
            return
        }

        const projected = visibility.actions.project(action, perspective, { config: game.config })
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
