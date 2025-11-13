import type { GameAction, GameState } from '@tabletop/common'

export type ActionResults<T extends GameState> = {
    processedActions: GameAction[]
    updatedState: T
    revealing: boolean
}

export class GameActionResults<T extends GameState> implements ActionResults<T> {
    revealing: boolean

    constructor(
        public processedActions: GameAction[],
        public updatedState: T
    ) {
        this.revealing = processedActions.some((action) => action.revealsInfo)
    }

    add(other: GameActionResults<T>) {
        this.processedActions.push(...other.processedActions)
        this.updatedState = other.updatedState
        this.revealing = this.revealing || other.revealing
    }
}
