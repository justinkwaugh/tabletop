import { prefersReducedMotion } from 'svelte/motion'
import type { BoardAnimationHost, BoardStateChange } from './markerMotion.js'

// One state-change listener on the session, registered while its layer is mounted; unregistering
// drops whatever motion it still holds.
export abstract class StateAnimator {
    private readonly listener = (change: BoardStateChange) => this.onGameStateChange(change)

    constructor(
        protected readonly host: BoardAnimationHost,
        protected readonly reducedMotion: () => boolean = () => prefersReducedMotion.current
    ) {}

    register() {
        this.host.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.host.removeGameStateChangeListener(this.listener)
        this.clear()
    }

    protected abstract clear(): void

    protected abstract onGameStateChange(change: BoardStateChange): Promise<void>
}
