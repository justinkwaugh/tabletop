import { type HydratedGameState } from '../model/gameState.js'
import { GameConfig } from '../definition/gameConfig.js'
import { ActionSource, GameAction } from './gameAction.js'
import { nanoid } from 'nanoid'

export class MachineContext {
    private addedActionCount = 0
    private intialActionId: string
    readonly gameConfig: GameConfig
    readonly gameState: HydratedGameState
    private pendingActions: GameAction[]

    constructor({
        action,
        gameConfig,
        gameState
    }: {
        action?: GameAction
        gameConfig: GameConfig
        gameState: HydratedGameState
    }) {
        this.intialActionId = action?.id ?? nanoid()
        this.gameConfig = gameConfig
        this.gameState = gameState
        this.pendingActions = action ? [action] : []
    }

    addPendingAction(action: GameAction) {
        // We use a generated id based on the initial action to ensure that the id is both unique and deterministic
        // so that the client can generate the same set of ids as the server
        action.id = this.generateNextActionId()
        action.source = ActionSource.System

        this.pendingActions.push(action)
    }

    nextPendingAction(): GameAction | undefined {
        return this.pendingActions.shift()
    }

    getPendingActions(): GameAction[] {
        return this.pendingActions
    }

    private generateNextActionId(): string {
        this.addedActionCount++
        return `${this.intialActionId}-${this.addedActionCount}`
    }
}
