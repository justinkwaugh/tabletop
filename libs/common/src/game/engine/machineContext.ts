import { type HydratedGameState } from '../model/gameState.js'
import { GameConfig } from '../definition/gameConfig.js'
import { ActionSource, createAction, GameAction } from './gameAction.js'
import { nanoid } from 'nanoid'
import { Static, TSchema } from 'typebox'

export class MachineContext {
    readonly gameConfig: GameConfig
    readonly gameState: HydratedGameState
    private pendingActions: GameAction[]

    /**
     * @deprecated only for prior action id generation
     */
    private addedActionCount = 0

    /**
     * @deprecated only for prior action id generation
     */
    private initialActionId: string

    constructor({
        action,
        gameConfig,
        gameState
    }: {
        action?: GameAction
        gameConfig: GameConfig
        gameState: HydratedGameState
    }) {
        this.initialActionId = action?.id ?? nanoid()
        this.gameConfig = gameConfig
        this.gameState = gameState
        this.pendingActions = action ? [action] : []
    }

    nextPendingAction(): GameAction | undefined {
        return this.pendingActions.shift()
    }

    getPendingActions(): GameAction[] {
        return this.pendingActions
    }

    addSystemAction<T extends TSchema>(schema: T, data: Partial<Static<T>>) {
        const action = this.createSystemAction(schema, data)
        this.pendingActions.push(action)
    }

    createSystemAction<T extends TSchema>(schema: T, data: Partial<Static<T>>): Static<T> {
        const copy = { ...data }
        const partialAction = this.generatePartialSystemAction()
        Object.assign(copy, partialAction)
        return createAction(schema, copy)
    }

    private generatePartialSystemAction(): Partial<GameAction> {
        return {
            id: this.gameState.getPrng().randId(), // Deterministic id
            gameId: this.gameState.gameId,
            source: ActionSource.System,
            createdAt: new Date()
        }
    }

    /**
     * @deprecated use addSystemAction instead for convenience, type safety and better id generation
     */
    addPendingAction(action: GameAction) {
        // We use a generated id based on the initial action to ensure that the id is both unique and deterministic
        // so that the client can generate the same set of ids as the server
        action.id = this.generateNextActionId()
        action.source = ActionSource.System

        this.pendingActions.push(action)
    }

    /**
     * @deprecated better to use prng directly for id generation
     */
    private generateNextActionId(): string {
        this.addedActionCount++
        return `${this.initialActionId}-${this.addedActionCount}`
    }
}
