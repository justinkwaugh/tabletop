import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import {
    calculateActionChecksum,
    type Game,
    type GameAction,
    GameEngine,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import { GameActionResults } from './gameActionResults.svelte.js'

// This class holds everything needed to represent the current context of a game
// for the UI.  It is UI specific because it uses Svelte's $state for reactivity.

export type CloneInterceptor<T extends GameState> = {
    interceptGame?: (game: Game) => void
    interceptState?: (state: T) => void
    interceptActions?: (actions: GameAction[]) => void
}

export class GameContext<T extends GameState, U extends HydratedGameState & T> {
    definition: GameUiDefinition<T, U>
    game: Game = $state.raw({} as Game)
    state: T = $state.raw({} as T)
    actions: GameAction[] = $state.raw([] as GameAction[])
    engine: GameEngine

    private actionsById: Map<string, GameAction> = new Map([])

    constructor({
        definition,
        game,
        state,
        actions
    }: {
        definition: GameUiDefinition<T, U>
        game: Game
        state: T
        actions: GameAction[]
    }) {
        this.definition = definition
        this.game = game
        this.state = state
        this.engine = new GameEngine(definition)
        this.initializeActions(actions)
    }

    clone(interceptor?: CloneInterceptor<T>): GameContext<T, U> {
        const game = structuredClone(this.game)
        const state = structuredClone(this.state) as T
        const actions = this.actions.map((action) => structuredClone($state.snapshot(action)))

        if (interceptor?.interceptGame) {
            interceptor.interceptGame(game)
        }
        if (interceptor?.interceptState) {
            interceptor.interceptState(state)
        }
        if (interceptor?.interceptActions) {
            interceptor.interceptActions(actions)
        }

        return new GameContext({
            definition: this.definition,
            game,
            state,
            actions
        })
    }

    restoreFrom(context: GameContext<T, U>) {
        this.game = context.game
        this.actions = context.actions
        this.actionsById = new Map(context.actionsById)
        this.updateGameState(context.state)
    }

    addActions(actions: GameAction[]) {
        actions.forEach((action) => {
            if (
                action.index === undefined ||
                action.index < 0 ||
                action.index > this.actions.length
            ) {
                throw new Error(`Action ${action.id} has an invalid index ${action.index}`)
            }
            this.actions.splice(action.index, 0, action)
            this.actionsById.set(action.id, action)
        })

        // Make it reactive
        this.actions = structuredClone(this.actions)
    }

    addAction(action: GameAction) {
        this.addActions([action])
    }

    upsertAction(action: GameAction) {
        if (action.index === undefined || action.index < 0 || action.index > this.actions.length) {
            throw new Error(`Action ${action.id} has an invalid index ${action.index}`)
        }

        if (action.index === this.actions.length) {
            this.actions.push(action)
        } else {
            const priorAction = this.actions[action.index]
            if (priorAction.id !== action.id) {
                this.actionsById.delete(priorAction.id)
            }
            this.actions[action.index] = action
            this.actionsById.set(action.id, action)
        }

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
        this.game = structuredClone(game)
    }

    updateGameState(gameState?: T) {
        if (!gameState) {
            return
        }
        this.state = structuredClone(gameState)
    }

    applyActionResults(actionResults: GameActionResults<T>) {
        this.updateGameState(actionResults.updatedState)
        this.addActions(actionResults.processedActions)
    }

    verifyFullChecksum() {
        const checksum = calculateActionChecksum(0, this.actions)
        if (checksum !== this.state?.actionChecksum) {
            throw new Error(
                'Full checksum validation failed, got ' +
                    checksum +
                    ' expected ' +
                    this.state?.actionChecksum
            )
        }
    }

    undoLastAction(): GameAction | undefined {
        const action = this.popAction()
        if (!action) {
            return undefined
        }

        const updatedState = this.engine.undoAction(this.state, action) as T
        this.updateGameState(updatedState)

        return action
    }

    applyAction(action: GameAction): GameActionResults<T> {
        const result = this.engine.run(action, this.state, this.game)
        this.updateGameState(result.updatedState as T)
        this.addActions(result.processedActions)
        return new GameActionResults(result.processedActions, result.updatedState as T)
    }

    private initializeActions(actions: GameAction[]) {
        // all actions must have an index
        if (actions.find((action) => action.index === undefined)) {
            throw new Error('All actions must have an index')
        }

        this.actions = actions.toSorted((a, b) => a.index! - b.index!)
        this.verifyFullChecksum()
        this.actionsById = new Map(this.actions.map((action) => [action.id, action]))
    }
}
