import { GameState, RunMode, type GameAction, type HydratedGameState } from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'

export type StepDirection = 'forward' | 'backward'
export type HistoryAnimationIntent = 'full-action' | 'state-only' | 'silent-swap'

export type HistoryEnterCallback = () => void
export type HistoryActionCallback = (
    action: GameAction | undefined,
    animationIntent?: HistoryAnimationIntent
) => void
export type HistoryShouldAutoStepCallback = (action: GameAction, next?: GameAction) => boolean
export type HistoryExitCallback = (animationIntent?: HistoryAnimationIntent) => void
export type HistoryWaitForTransitionSettledCallback = () => Promise<void>

export type HistoryCallbacks = {
    onHistoryEnter?: HistoryEnterCallback
    onHistoryAction?: HistoryActionCallback
    shouldAutoStepAction?: HistoryShouldAutoStepCallback
    onHistoryExit?: HistoryExitCallback
    waitForTransitionSettled?: HistoryWaitForTransitionSettledCallback
}

export class GameHistory<T extends GameState, U extends HydratedGameState<T> & T> {
    private gameContext: GameContext<T, U>

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
    private disabled = $state(false)
    private stepping: boolean = false
    private playTimer: ReturnType<typeof setTimeout> | null = null
    private playOnEnable: boolean = false

    private onHistoryEnter: HistoryEnterCallback = () => {}
    private onHistoryAction: HistoryActionCallback = () => {}
    private shouldAutoStepAction: HistoryShouldAutoStepCallback = () => false
    private onHistoryExit: HistoryExitCallback = () => {}
    private waitForTransitionSettled: HistoryWaitForTransitionSettledCallback = async () => {}

    constructor(gameContext: GameContext<T, U>, callbacks?: HistoryCallbacks) {
        this.gameContext = $state(gameContext)
        this.actionIndex = gameContext.actions.length - 1
        if (callbacks) {
            this.onHistoryEnter = callbacks.onHistoryEnter ?? this.onHistoryEnter
            this.onHistoryAction = callbacks.onHistoryAction ?? this.onHistoryAction
            this.shouldAutoStepAction = callbacks.shouldAutoStepAction ?? this.shouldAutoStepAction
            this.onHistoryExit = callbacks.onHistoryExit ?? this.onHistoryExit
            this.waitForTransitionSettled =
                callbacks.waitForTransitionSettled ?? this.waitForTransitionSettled
        }
    }

    updateSourceGameContext(gameContext: GameContext<T, U>) {
        this.exitHistory()
        this.gameContext = gameContext
    }

    disable() {
        this.disabled = true
    }

    enable() {
        this.disabled = false

        // Resume playing if needed
        if (this.playOnEnable) {
            this.playOnEnable = false
            this.stepForward({ stopPlayback: false, animated: true })
                .then(() => {
                    if (this.playing) {
                        this.schedulePlayTimer()
                    }
                })
                .catch(() => {
                    console.log('Error resuming history playback')
                })
        }
    }

    isDisabled() {
        return this.disabled
    }

    public async goToBeginning() {
        if (this.stepping || this.disabled) {
            return
        }
        this.stepping = true
        try {
            await this.gotoAction(-1)
        } finally {
            this.stepping = false
        }
    }

    public goToEnd() {
        if (this.stepping || this.disabled || !this.historyContext) {
            return
        }
        this.stepping = true

        try {
            this.exitHistory()
        } finally {
            this.stepping = false
        }
    }

    public async goToPreviousAction() {
        if (this.stepping || this.disabled) {
            return
        }
        this.stepping = true
        try {
            await this.stepBackward({ animationIntent: 'state-only' })
        } finally {
            // This allows stupid flip animations to finish
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    public async goToNextAction(animated: boolean = false) {
        if (this.stepping || this.disabled) {
            return
        }
        this.stepping = true
        try {
            await this.stepForward({
                animated,
                animationIntent: animated ? 'full-action' : 'state-only'
            })
        } finally {
            // This allows stupid flip animations to finish
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    public async goToActionIndex(actionIndex: number) {
        if (this.stepping || this.disabled || !Number.isFinite(actionIndex)) {
            return
        }
        this.stepping = true
        try {
            await this.gotoAction(Math.trunc(actionIndex), {
                ensureHistory: true,
                animationIntent: 'state-only'
            })
        } finally {
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    public async replayRange(
        startIndex: number,
        endIndex: number = startIndex,
        { holdMs = 750 }: { holdMs?: number } = {}
    ) {
        if (
            this.stepping ||
            this.disabled ||
            this.gameContext.actions.length === 0 ||
            !Number.isFinite(startIndex) ||
            !Number.isFinite(endIndex)
        ) {
            return
        }

        this.stopHistoryPlayback()
        this.stepping = true

        const returnTarget = this.inHistory
            ? { type: 'history' as const, actionIndex: this.actionIndex }
            : { type: 'live' as const }

        try {
            const actions = this.historyContext?.actions ?? this.gameContext.actions
            const lastAvailableActionIndex = actions.length - 1
            if (lastAvailableActionIndex < 0) {
                return
            }

            let normalizedStartIndex = Math.trunc(startIndex)
            let normalizedEndIndex = Math.trunc(endIndex)
            if (normalizedEndIndex < normalizedStartIndex) {
                ;[normalizedStartIndex, normalizedEndIndex] = [
                    normalizedEndIndex,
                    normalizedStartIndex
                ]
            }

            normalizedStartIndex = Math.max(0, Math.min(normalizedStartIndex, lastAvailableActionIndex))
            normalizedEndIndex = Math.max(
                normalizedStartIndex,
                Math.min(normalizedEndIndex, lastAvailableActionIndex)
            )

            await this.gotoAction(normalizedStartIndex - 1, {
                ensureHistory: true,
                animationIntent: 'silent-swap',
                exact: true
            })
            await this.waitForTransitionSettled()
            await this.waitMs(holdMs)

            await this.stepForward({
                toActionIndex: normalizedEndIndex,
                stopPlayback: true,
                animated: true,
                animationIntent: 'full-action'
            })
            await this.waitForTransitionSettled()

            if (returnTarget.type === 'live') {
                this.exitHistory('silent-swap')
            } else {
                await this.gotoAction(returnTarget.actionIndex, {
                    ensureHistory: true,
                    animationIntent: 'silent-swap',
                    exact: true
                })
            }
            await this.waitForTransitionSettled()
        } finally {
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    private async waitMs(durationMs: number) {
        if (!(durationMs > 0)) {
            return
        }

        await new Promise<void>((resolve) => {
            setTimeout(resolve, durationMs)
        })
    }

    private async stepBackward({
        toActionIndex,
        stopPlayback = true,
        predicate,
        animationIntent = 'state-only',
        exact = false
    }: {
        toActionIndex?: number
        stopPlayback?: boolean
        predicate?: () => boolean
        animationIntent?: HistoryAnimationIntent
        exact?: boolean
    } = {}) {
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
            const updatedState = this.historyContext.engine.undoAction(stateSnapshot, lastAction)
            this.actionIndex -= 1
            stateSnapshot = updatedState
        } while (
            (this.actionIndex >= 0 &&
                ((toActionIndex !== undefined && (lastAction.index ?? 0) > toActionIndex + 1) ||
                    (!exact &&
                        this.shouldAutoStepAction(
                            this.historyContext.actions[this.actionIndex],
                            this.historyContext.actions.at(this.actionIndex + 1)
                        )))) ||
            (predicate && predicate() === false)
        )
        this.onHistoryAction(
            this.actionIndex >= 0 ? this.historyContext.actions[this.actionIndex] : undefined,
            animationIntent
        )
        this.historyContext.updateGameState(stateSnapshot)

        if (stopPlayback) {
            this.stopHistoryPlayback()
        }
    }

    private async stepForward({
        toActionIndex,
        stopPlayback = true,
        animated = false,
        predicate,
        animationIntent = animated ? 'full-action' : 'state-only',
        exact = false
    }: {
        toActionIndex?: number
        stopPlayback?: boolean
        animated?: boolean
        predicate?: () => boolean
        animationIntent?: HistoryAnimationIntent
        exact?: boolean
    } = {}) {
        if (!this.historyContext) {
            return
        }

        if (this.actionIndex === this.historyContext.actions.length - 1) {
            this.stopHistoryPlayback()
            this.exitHistory(animationIntent)
            return
        }

        if (this.actionIndex >= this.historyContext.actions.length - 1) {
            return
        }

        const gameSnapshot = this.historyContext.game
        let stateSnapshot = this.historyContext.state as T

        let nextAction: GameAction | undefined
        do {
            const nextActionIndex = this.actionIndex + 1
            nextAction = this.historyContext.actions[nextActionIndex] as GameAction
            const { updatedState } = this.historyContext.engine.run(
                nextAction,
                stateSnapshot,
                gameSnapshot,
                RunMode.Single
            )
            stateSnapshot = updatedState
            this.actionIndex = nextActionIndex
        } while (
            (this.actionIndex < this.historyContext.actions.length - 1 &&
                ((toActionIndex !== undefined && (nextAction.index ?? 0) < toActionIndex) ||
                    (!exact &&
                        this.shouldAutoStepAction(
                            nextAction,
                            this.historyContext.actions.at(this.actionIndex + 1)
                        )))) ||
            (predicate && predicate() === false)
        )
        this.onHistoryAction(this.historyContext.actions[this.actionIndex], animationIntent)
        this.historyContext.updateGameState(stateSnapshot)

        const skippableLastAction = this.shouldAutoStepAction(nextAction)
        if (stopPlayback || skippableLastAction) {
            this.stopHistoryPlayback()
        }

        if (skippableLastAction) {
            if (animationIntent === 'full-action') {
                await this.waitForTransitionSettled()
            }
            this.exitHistory(animationIntent)
        }
    }

    private async gotoAction(
        actionIndex: number,
        {
            ensureHistory = false,
            animationIntent = 'state-only',
            exact = false
        }: {
            ensureHistory?: boolean
            animationIntent?: HistoryAnimationIntent
            exact?: boolean
        } = {}
    ) {
        if (!this.historyContext) {
            if (this.gameContext.actions.length === 0) {
                return
            }
            if (actionIndex >= this.gameContext.actions.length - 1 && !ensureHistory) {
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
            await this.stepBackward({ toActionIndex: actionIndex, animationIntent, exact })
        } else if (actionIndex > this.actionIndex) {
            await this.stepForward({ toActionIndex: actionIndex, animationIntent, exact })
        }
    }

    public async playHistory() {
        if (this.disabled || this.playing || this.gameContext.actions.length === 0) {
            return
        }

        this.playing = true

        if (!this.historyContext || this.actionIndex === this.historyContext.actions.length - 1) {
            await this.stepBackward({
                toActionIndex: -1,
                stopPlayback: false,
                animationIntent: 'full-action'
            })
        } else {
            await this.stepForward({
                stopPlayback: false,
                animated: true,
                animationIntent: 'full-action'
            })
        }
        if (this.playing) {
            this.schedulePlayTimer()
        }
    }

    private clearPlayTimer() {
        if (this.playTimer) {
            clearInterval(this.playTimer)
            this.playTimer = null
        }
    }

    private schedulePlayTimer() {
        this.playTimer = setInterval(async () => {
            if (this.disabled) {
                this.playOnEnable = true
                this.clearPlayTimer()
            } else {
                await this.stepForward({
                    stopPlayback: false,
                    animated: true,
                    animationIntent: 'full-action'
                })
            }
        }, 1000)
    }

    public async goToPlayersPreviousTurn(playerId: string) {
        if (
            this.disabled ||
            this.stepping ||
            this.gameContext.actions.length === 0 ||
            this.actionIndex === -1
        ) {
            return
        }
        await this.stepUntil('backward', () => {
            return (
                this.actionIndex === -1 ||
                !this.historyContext ||
                this.historyContext.actions[this.actionIndex].playerId === playerId
            )
        })
    }

    public async goToPlayersNextTurn(playerId: string) {
        if (!this.playerHasFutureTurn(playerId)) {
            return
        }

        if (this.disabled || this.stepping || !this.historyContext) {
            return
        }

        // Now find my next turn
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
        this.playOnEnable = false
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
        this.stepping = true
        try {
            if (direction === 'backward') {
                await this.stepBackward({
                    stopPlayback: true,
                    predicate,
                    animationIntent: 'state-only'
                })
            } else {
                await this.stepForward({
                    stopPlayback: true,
                    predicate,
                    animationIntent: 'state-only'
                })
            }
        } finally {
            this.stepping = false
        }
    }

    private enterHistory() {
        if (this.inHistory) {
            return
        }
        this.historyContext = this.gameContext.clone()
        this.actionIndex = this.historyContext.actions.length - 1

        this.onHistoryEnter()
    }

    private exitHistory(animationIntent: HistoryAnimationIntent = 'state-only') {
        if (!this.inHistory) {
            return
        }
        this.historyContext = undefined
        this.actionIndex = 0

        this.onHistoryExit(animationIntent)
    }
}
