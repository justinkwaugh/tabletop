import type { HydratedGameState } from '../model/gameState.js'
import type { GameConfig } from '../model/gameConfig.js'
import { ActionSource, createAction } from './gameAction.js'
import { nanoid } from 'nanoid'
import type { GameAction } from './gameAction.js'
import type { Static, TSchema } from 'typebox'

export class MachineContext<State extends HydratedGameState = HydratedGameState> {
    readonly gameConfig: GameConfig
    readonly gameState: State
    private pendingActions: GameAction[]

    constructor({
        action,
        gameConfig,
        gameState
    }: {
        action?: GameAction
        gameConfig: GameConfig
        gameState: State
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

    addSystemAction<T extends TSchema>(schema: T, data?: Partial<Static<T>>) {
        const action = this.createSystemAction(schema, data)
        this.pendingActions.push(action)
    }

    createSystemAction<T extends TSchema>(schema: T, data?: Partial<Static<T>>): Static<T> {
        const actionData = data ?? {}
        const partialAction = this.generatePartialSystemAction()
        Object.assign(actionData, partialAction)
        return createAction(schema, actionData)
    }

    private generatePartialSystemAction(): Partial<GameAction> {
        return {
            id: this.gameState.isAtLeastVersion(2)
                ? this.gameState.getPrng().randId()
                : this.generateLegacyActionId(), // Deterministic id
            gameId: this.gameState.gameId,
            source: ActionSource.System,
            createdAt: new Date()
        }
    }

    /**
     * @deprecated only for prior action id generation
     */
    private addedActionCount = 0

    /**
     * @deprecated only for prior action id generation
     */
    private initialActionId: string

    /**
     * @deprecated better to use prng directly for id generation
     */
    private generateLegacyActionId(): string {
        this.addedActionCount++
        return `${this.initialActionId}-${this.addedActionCount}`
    }
}
