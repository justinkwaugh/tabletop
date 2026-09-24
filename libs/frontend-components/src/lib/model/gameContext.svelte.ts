import type { GameUIRuntime } from '$lib/definition/gameUiDefinition.js'
import {
    calculateActionChecksum,
    type Game,
    type GameAction,
    GameEngine,
    type GameState,
    type HydratedGameState,
    deepFreeze
} from '@tabletop/common'
import { GameActionResults } from './gameActionResults.svelte.js'

// This class holds everything needed to represent the current context of a game
// for the UI.  It is UI specific because it uses Svelte's $state for reactivity.

export type CloneInterceptor<T extends GameState> = {
    interceptGame?: (game: Game) => void
    interceptState?: (state: T) => void
    interceptActions?: (actions: GameAction[]) => void
}

export type HistoryCheckpoint = Pick<GameState, 'actionCount' | 'actionChecksum'>

export class GameContext<T extends GameState, U extends HydratedGameState<T> & T> {
    runtime: GameUIRuntime<T, U>
    game: Game
    state: T
    actions: GameAction[]
    engine: GameEngine<T, U>
    private historyCheckpoint: HistoryCheckpoint = $state.raw({ actionCount: 0, actionChecksum: 0 })

    get historyStartIndex(): number {
        return this.historyCheckpoint.actionCount
    }

    get hasCompleteHistory(): boolean {
        return this.historyStartIndex === 0
    }

    get nextActionIndex(): number {
        return this.historyStartIndex + this.actions.length
    }

    private actionsById: Map<string, GameAction> = new Map([])

    constructor({
        runtime,
        game,
        state,
        actions,
        historyComplete = true,
        historyCheckpoint
    }: {
        runtime: GameUIRuntime<T, U>
        game: Game
        state: T
        actions: GameAction[]
        historyComplete?: boolean
        historyCheckpoint?: HistoryCheckpoint
    }) {
        this.historyCheckpoint =
            historyCheckpoint ??
            (historyComplete
                ? { actionCount: 0, actionChecksum: 0 }
                : { actionCount: state.actionCount, actionChecksum: state.actionChecksum })
        this.runtime = runtime
        this.game = $state.raw(game)
        this.state = $state.raw(state)
        this.actions = $state.raw(this.initializeActions(actions))
        this.actionsById = new Map(this.actions.map((action) => [action.id, action]))
        this.engine = new GameEngine(runtime)

        this.verifyFullChecksum()
    }

    clone(interceptor?: CloneInterceptor<T>): GameContext<T, U> {
        const game = structuredClone(this.game)
        const state = structuredClone(this.state) as T
        const actions = this.actions.map((action) => structuredClone(action))

        if (interceptor?.interceptGame) {
            interceptor.interceptGame(game)
        }
        if (interceptor?.interceptState) {
            interceptor.interceptState(state)
        }
        if (interceptor?.interceptActions) {
            interceptor.interceptActions(actions)
        }

        deepFreeze(game)
        deepFreeze(state)
        for (const action of actions) {
            deepFreeze(action)
        }

        return new GameContext({
            runtime: this.runtime,
            game,
            state,
            actions,
            historyCheckpoint: this.historyCheckpoint
        })
    }

    restoreFrom(context: GameContext<T, U>) {
        this.historyCheckpoint = context.historyCheckpoint
        this.game = context.game
        this.actions = context.actions
        this.actionsById = new Map(context.actionsById)
        this.updateGameState(context.state)
    }

    addActions(actions: GameAction[]) {
        actions.forEach((action) => {
            if (action.index === undefined || action.index !== this.nextActionIndex) {
                throw new Error(`Action ${action.id} has an invalid index ${action.index}`)
            }
            deepFreeze(action)
            this.actions.push(action)
            this.actionsById.set(action.id, action)
        })

        // Make it reactive
        this.actions = structuredClone(this.actions)
    }

    addAction(action: GameAction) {
        this.addActions([action])
    }

    upsertAction(action: GameAction) {
        const actionClone = deepFreeze(structuredClone(action))
        if (
            actionClone.index === undefined ||
            actionClone.index < this.historyStartIndex ||
            actionClone.index > this.nextActionIndex
        ) {
            throw new Error(`Action ${actionClone.id} has an invalid index ${actionClone.index}`)
        }

        const localIndex = actionClone.index - this.historyStartIndex
        if (actionClone.index === this.nextActionIndex) {
            this.actions.push(actionClone)
        } else {
            const priorAction = this.actions[localIndex]
            if (priorAction.id !== actionClone.id) {
                this.actionsById.delete(priorAction.id)
            }
            this.actions[localIndex] = actionClone
        }
        this.actionsById.set(actionClone.id, actionClone)

        // Make it reactive
        this.actions = structuredClone(this.actions)
    }

    popAction(): GameAction | undefined {
        if (this.actions.length === 0) {
            return undefined
        }
        const action = this.actions.pop()
        if (action) {
            this.actionsById.delete(action.id)
        }

        // Make it reactive
        this.actions = structuredClone(this.actions)

        return action
    }

    hasAction(actionId: string): boolean {
        return this.actionsById.has(actionId)
    }

    findAction(actionId: string): GameAction | undefined {
        return this.actionsById.get(actionId)
    }

    updateGame(game: Game) {
        this.game = deepFreeze(structuredClone(game))
    }

    updateGameState(gameState?: T) {
        if (!gameState) {
            return
        }
        this.state = deepFreeze(structuredClone(gameState))
    }

    applyActionResults(actionResults: GameActionResults<T>) {
        this.updateGameState(actionResults.updatedState)
        this.addActions(actionResults.processedActions)
    }

    verifyFullChecksum() {
        for (const [offset, action] of this.actions.entries()) {
            if (action.index !== this.historyStartIndex + offset) {
                throw new Error('Action History must be contiguous from its checkpoint')
            }
        }
        const checksum = calculateActionChecksum(
            this.historyCheckpoint.actionChecksum,
            this.actions
        )
        if (checksum !== this.state?.actionChecksum) {
            throw new Error(
                'Full checksum validation failed, got ' +
                    checksum +
                    ' expected ' +
                    this.state?.actionChecksum
            )
        }
    }

    hydrateHistory(source: GameContext<T, U>): boolean {
        if (this.hasCompleteHistory) return true
        if (!source.hasCompleteHistory || source.state.actionCount < this.historyStartIndex)
            return false
        const prefix = source.actions.slice(0, this.historyStartIndex)
        if (calculateActionChecksum(0, prefix) !== this.historyCheckpoint.actionChecksum)
            return false
        for (const action of this.actions) {
            const other = source.actions[action.index!]
            if (other !== undefined && other.id !== action.id) return false
        }
        this.actions = [...prefix, ...this.actions]
        this.actionsById = new Map(this.actions.map((action) => [action.id, action]))
        this.historyCheckpoint = { actionCount: 0, actionChecksum: 0 }
        this.verifyFullChecksum()
        return true
    }

    undoLastAction(): GameAction | undefined {
        const action = this.popAction()
        if (!action) {
            return undefined
        }

        const updatedState = this.engine.undoProcessedAction({ action, state: this.state })
        this.updateGameState(updatedState)

        return action
    }

    applyAction(action: GameAction): GameActionResults<T> {
        const result = this.engine.executeCanonicalAction({
            action,
            state: this.state,
            game: this.game
        })
        this.updateGameState(result.updatedState)
        this.addActions(result.processedActions)
        return new GameActionResults(result.processedActions, result.updatedState)
    }

    private initializeActions(actions: GameAction[]): GameAction[] {
        // all actions must have an index
        if (actions.find((action) => action.index === undefined)) {
            throw new Error('All actions must have an index')
        }

        return actions.toSorted((a, b) => a.index! - b.index!)
    }
}
