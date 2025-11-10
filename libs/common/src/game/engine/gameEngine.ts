import jsonpatch, { Operation } from 'fast-json-patch'
import { GameAction, HydratedAction, Patch } from './gameAction.js'
import { Game, GameStatus } from '../model/game.js'
import { GameState, HydratedGameState, UninitializedGameState } from '../model/gameState.js'
import { MachineContext } from './machineContext.js'
import { MachineStateHandler } from './machineStateHandler.js'
import { GameDefinition } from '../definition/gameDefinition.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import { nanoid } from 'nanoid'
import { generateSeed } from '../../util/prng.js'

export type ActionResult = {
    processedActions: GameAction[]
    updatedState: GameState
    indexOffset: number
}

export enum RunMode {
    Single = 'single',
    Multiple = 'multiple'
}

export class GameEngine {
    constructor(public readonly definition: GameDefinition) {}

    generateUninitializedState(game: Game): UninitializedGameState {
        const seed = game.seed ?? generateSeed()
        return {
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

    startGame(game: Game): { startedGame: Game; initialState: GameState } {
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

    getValidActionTypesForPlayer(game: Game, state: GameState, playerId: string): string[] {
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
        state: GameState,
        game: Game,
        mode: RunMode = RunMode.Multiple
    ): ActionResult {
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
            if (!currentAction) {
                throw Error('Action to process was unexpectedly null')
            }

            if (!this.isPlayerAllowed(currentAction, hydratedState)) {
                throw Error(`Player ${currentAction.playerId} is not an active player`)
            }

            const hydratedAction = this.definition.hydrator.hydrateAction(
                structuredClone(currentAction)
            )
            if (!hydratedAction.createdAt) {
                hydratedAction.createdAt = new Date()
            }

            const stateHandler = this.getStateHandler(hydratedState)
            if (!stateHandler.isValidAction(hydratedAction, machineContext)) {
                throw Error(
                    `Action of type ${hydratedAction.type} is not valid for the current machine state: ${hydratedState.machineState}`
                )
            }

            hydratedAction.apply(hydratedState, machineContext)

            const nextMachineState = stateHandler.onAction(hydratedAction, machineContext)

            hydratedState.recordAction(hydratedAction)
            hydratedState.machineState = nextMachineState

            const nextHandler = this.getStateHandler(hydratedState)
            nextHandler.enter(machineContext)

            const stateBeforeAction = updatedState
            updatedState = hydratedState.dehydrate()

            const undoPatch = jsonpatch.compare(updatedState, stateBeforeAction)

            const dehydratedAction = hydratedAction.dehydrate()
            dehydratedAction.undoPatch = undoPatch as Patch

            processedActions.push(dehydratedAction)
        }

        return { processedActions, updatedState, indexOffset }
    }

    undoAction(state: GameState, action: GameAction): GameState {
        const stateCopy = structuredClone(state)
        const initialChecksum = state.actionChecksum
        const undoPatch = action.undoPatch
        if (!undoPatch) {
            throw Error('Action has no undo patch')
        }
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

    private getStateHandler(state: GameState): MachineStateHandler<HydratedAction> {
        const stateHandler = this.definition.stateHandlers[state.machineState]
        if (!stateHandler) {
            throw Error(`Unknown machine state: ${state.machineState}`)
        }
        return stateHandler
    }
}
