import { GameState, RunMode, type GameAction, type HydratedGameState } from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'

export type StepDirection = 'forward' | 'backward'

export type HistoryEnterCallback = () => void
export type HistoryActionCallback = (action: GameAction | undefined) => void
export type HistoryShouldAutoStepCallback = (action: GameAction) => boolean
export type HistoryExitCallback = () => void

export type HistoryCallbacks = {
    onHistoryEnter?: HistoryEnterCallback
    onHistoryAction?: HistoryActionCallback
    shouldAutoStepAction?: HistoryShouldAutoStepCallback
    onHistoryExit?: HistoryExitCallback
}

export class GameHistory<T extends GameState, U extends HydratedGameState & T> {
    private gameContext: GameContext<T, U> = $state({} as GameContext<T, U>)

    // This holds a clone of the game context when entering history mode
    private historyContext?: GameContext<T, U> = $state(undefined)

    inHistory: boolean = $derived.by(() => this.historyContext !== undefined)
    actionIndex: number = $state(0)

    // This context represents the history navigated game with actions filtered by the action index
    visibleContext: GameContext<T, U> = $derived.by(() => {
        if (!this.historyContext) {
            return this.gameContext
        }

        const visibleContext = this.historyContext.clone({
            interceptActions: (actions) => {
                actions.splice(this.actionIndex + 1)
            }
        })
        return visibleContext
    })

    currentAction: GameAction | undefined = $derived.by(() => {
        if (!this.historyContext || this.actionIndex < 0) {
            return undefined
        }
        return this.historyContext.actions[this.actionIndex]
    })

    hasPreviousAction: boolean = $derived.by(() => {
        return this.inHistory ? this.actionIndex >= 0 : this.gameContext.actions.length > 0
    })

    hasNextAction: boolean = $derived.by(() => {
        if (!this.historyContext) {
            return false
        }
        return this.actionIndex <= this.historyContext.actions.length - 1
    })

    playing: boolean = $state(false)
    private stepping: boolean = false
    private playTimer: ReturnType<typeof setTimeout> | null = null

    private onHistoryEnter: HistoryEnterCallback = () => {}
    private onHistoryAction: HistoryActionCallback = () => {}
    private shouldAutoStepAction: HistoryShouldAutoStepCallback = () => false
    private onHistoryExit: HistoryExitCallback = () => {}

    constructor(gameContext: GameContext<T, U>, callbacks?: HistoryCallbacks) {
        this.gameContext = gameContext
        this.actionIndex = gameContext.actions.length - 1
        if (callbacks) {
            this.onHistoryEnter = callbacks.onHistoryEnter ?? this.onHistoryEnter
            this.onHistoryAction = callbacks.onHistoryAction ?? this.onHistoryAction
            this.shouldAutoStepAction = callbacks.shouldAutoStepAction ?? this.shouldAutoStepAction
            this.onHistoryExit = callbacks.onHistoryExit ?? this.onHistoryExit
        }
    }

    updateSourceGameContext(gameContext: GameContext<T, U>) {
        this.exitHistory()
        this.gameContext = gameContext
    }

    public async goToBeginning() {
        if (this.stepping) {
            return
        }
        this.stepping = true
        try {
            await this.gotoAction(-1)
        } finally {
            this.stepping = false
        }
    }

    public async goToEnd() {
        if (this.stepping || !this.historyContext) {
            return
        }
        this.stepping = true
        try {
            await this.gotoAction(this.historyContext.actions.length - 1)
            this.exitHistory()
        } finally {
            this.stepping = false
        }
    }

    public async goToPreviousAction() {
        if (this.stepping) {
            return
        }
        this.stepping = true
        try {
            await this.stepBackward()
        } finally {
            // This allows stupid flip animations to finish
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    public async goToNextAction() {
        if (this.stepping) {
            return
        }
        this.stepping = true
        try {
            await this.stepForward()
        } finally {
            // This allows stupid flip animations to finish
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    private async stepBackward({
        toActionIndex,
        stopPlayback = true
    }: { toActionIndex?: number; stopPlayback?: boolean } = {}) {
        if (
            (this.inHistory && this.actionIndex < 0) ||
            (!this.inHistory && this.gameContext.actions.length === 0) ||
            (toActionIndex !== undefined && toActionIndex >= this.actionIndex)
        ) {
            return
        }

        this.enterHistory()

        if (!this.historyContext) {
            return
        }

        let stateSnapshot = this.historyContext.state as T
        let lastAction: GameAction | undefined
        do {
            lastAction = this.historyContext.actions[this.actionIndex]
            const updatedState = this.historyContext.engine.undoAction(
                stateSnapshot,
                lastAction
            ) as T
            this.actionIndex -= 1
            stateSnapshot = updatedState
        } while (
            this.actionIndex >= 0 &&
            ((toActionIndex !== undefined && (lastAction.index ?? 0) > toActionIndex + 1) ||
                this.shouldAutoStepAction(this.historyContext.actions[this.actionIndex]))
        )
        this.historyContext.updateGameState(stateSnapshot)
        this.onHistoryAction(
            this.actionIndex >= 0 ? this.historyContext.actions[this.actionIndex] : undefined
        )

        if (stopPlayback) {
            this.stopHistoryPlayback()
        }
    }

    private async stepForward({
        toActionIndex,
        stopPlayback = true
    }: { toActionIndex?: number; stopPlayback?: boolean } = {}) {
        if (!this.historyContext) {
            return
        }

        if (this.actionIndex === this.historyContext.actions.length - 1) {
            this.stopHistoryPlayback()
            this.exitHistory()
            return
        }

        if (this.actionIndex >= this.historyContext.actions.length - 1) {
            return
        }

        const gameSnapshot = this.historyContext.game
        let stateSnapshot = this.historyContext.state as T

        let nextAction: GameAction | undefined
        do {
            this.actionIndex += 1
            nextAction = this.historyContext.actions[this.actionIndex] as GameAction
            const { updatedState } = this.historyContext.engine.run(
                nextAction,
                stateSnapshot,
                gameSnapshot,
                RunMode.Single
            )
            stateSnapshot = updatedState as T
        } while (
            this.actionIndex < this.historyContext.actions.length - 1 &&
            ((toActionIndex !== undefined && (nextAction.index ?? 0) < toActionIndex) ||
                this.shouldAutoStepAction(nextAction))
        )
        this.historyContext.updateGameState(stateSnapshot)
        this.onHistoryAction(this.historyContext.actions[this.actionIndex])

        const skippableLastAction = this.shouldAutoStepAction(nextAction)
        if (stopPlayback || skippableLastAction) {
            this.stopHistoryPlayback()
        }

        if (skippableLastAction) {
            this.exitHistory()
        }
    }

    private async gotoAction(actionIndex: number) {
        if (!this.historyContext) {
            if (actionIndex >= this.gameContext.actions.length - 1) {
                return
            }
            this.enterHistory()
        }

        if (actionIndex < -1) {
            actionIndex = -1
        }

        if (this.historyContext && actionIndex > this.historyContext.actions.length - 1) {
            actionIndex = this.historyContext.actions.length - 1
        }

        if (actionIndex < this.actionIndex) {
            await this.stepBackward({ toActionIndex: actionIndex })
        } else if (actionIndex > this.actionIndex) {
            await this.stepForward({ toActionIndex: actionIndex })
        }
    }

    public async playHistory() {
        if (this.playing || this.gameContext.actions.length === 0) {
            return
        }

        this.playing = true

        if (!this.historyContext || this.actionIndex === this.historyContext.actions.length - 1) {
            await this.stepBackward({ toActionIndex: -1, stopPlayback: false })
        } else {
            await this.stepForward({ stopPlayback: false })
        }
        if (this.playing) {
            this.playTimer = setInterval(async () => {
                await this.stepForward({ stopPlayback: false })
            }, 1000)
        }
    }

    public async goToPlayersPreviousTurn(playerId: string) {
        if (this.stepping || this.gameContext.actions.length === 0 || this.actionIndex === -1) {
            return
        }

        this.stepping = true
        await this.stepUntil('backward', () => {
            return (
                this.actionIndex === -1 ||
                !this.historyContext ||
                this.historyContext.actions[this.actionIndex].playerId === playerId
            )
        })
    }

    public async goToPlayersNextTurn(playerId: string) {
        if (this.stepping || !this.historyContext) {
            return
        }

        // Now find my next turn
        this.stepping = true
        await this.stepUntil('forward', () => {
            return (
                !this.historyContext ||
                this.historyContext.actions[this.actionIndex].playerId === playerId
            )
        })
    }

    public stopHistoryPlayback() {
        if (!this.playing) {
            return
        }
        this.playing = false
        if (this.playTimer) {
            clearInterval(this.playTimer)
        }
    }

    public playerHasPriorTurn(playerId: string): boolean {
        const contextToSearch = this.historyContext ?? this.gameContext
        const startIndex = this.historyContext
            ? this.actionIndex
            : this.gameContext.actions.length - 1

        for (let i = startIndex; i >= 0; i--) {
            const action = contextToSearch.actions[i]
            if (action.playerId === playerId) {
                return true
            }
        }
        return false
    }

    public playerHasFutureTurn(playerId: string): boolean {
        if (!this.historyContext) {
            return false
        }
        // find next action for player
        for (let i = this.actionIndex + 1; i < this.historyContext.actions.length; i++) {
            const action = this.historyContext.actions[i]
            if (action.playerId === playerId) {
                return true
            }
        }
        return false
    }

    private async stepUntil(direction: StepDirection, predicate: () => boolean) {
        if (direction === 'backward') {
            await this.stepBackward({ stopPlayback: true })
        } else {
            await this.stepForward({ stopPlayback: true })
        }

        setTimeout(() => {
            if (predicate()) {
                this.stepping = false
            } else {
                void this.stepUntil(direction, predicate)
            }
        })
    }

    private enterHistory() {
        if (this.inHistory) {
            return
        }
        this.historyContext = this.gameContext.clone()
        this.actionIndex = this.historyContext.actions.length - 1

        this.onHistoryEnter()
    }

    private exitHistory() {
        if (!this.inHistory) {
            return
        }
        this.historyContext = undefined
        this.actionIndex = 0

        this.onHistoryExit()
    }
}
