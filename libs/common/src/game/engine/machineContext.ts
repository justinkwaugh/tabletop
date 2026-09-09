import type { HydratedGameState } from '../model/gameState.js'
import { Prng } from '../components/prng.js'
import type { GameConfig } from '../model/gameConfig.js'
import { ActionSource, createAction } from './gameAction.js'
import { nanoid } from 'nanoid'
import type { GameAction } from './gameAction.js'
import type * as Type from 'typebox'

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

    addSystemAction<T extends Type.TSchema>(schema: T, data?: Partial<Type.Static<T>>) {
        const action = this.createSystemAction(schema, data)
        this.pendingActions.push(action)
    }

    createSystemAction<T extends Type.TSchema>(
        schema: T,
        data?: Partial<Type.Static<T>>
    ): Type.Static<T> {
        const actionData = data ?? {}
        const partialAction = this.generatePartialSystemAction()
        Object.assign(actionData, partialAction)
        return createAction(schema, actionData)
    }

    private generatePartialSystemAction(): Partial<GameAction> {
        return {
            id: this.generateSystemActionId(),
            gameId: this.gameState.gameId,
            source: ActionSource.System,
            createdAt: new Date()
        }
    }

    private generatedSystemActionCount = 0
    private initialActionId: string

    private generateSystemActionId(): string {
        if (this.gameState.isAtLeastVersion(2)) {
            return new Prng(this.gameState.prng).randId()
        }
        return this.generateLegacyActionId()
    }

    /**
     * @deprecated only for version 1 Game Instances
     */
    private generateLegacyActionId(): string {
        this.generatedSystemActionCount++
        return `${this.initialActionId}-${this.generatedSystemActionCount}`
    }
}
