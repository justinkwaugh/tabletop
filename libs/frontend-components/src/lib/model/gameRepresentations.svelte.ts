import {
    assertExists,
    GameStorage,
    Visibility,
    type GameState,
    type HydratedGameState,
    type Player
} from '@tabletop/common'
import * as Value from 'typebox/value'
import type { RemoteApiService } from '$lib/services/remoteApiService.js'
import { GameContext } from './gameContext.svelte.js'

interface RepresentationDependencies<T extends GameState, U extends HydratedGameState<T> & T> {
    getGame: RemoteApiService['getGame']
    supportsHostView(): boolean
    getUserId(): string | undefined
    getChosenPlayerId(): string | undefined
    publish(context: GameContext<T, U>): void
    setLoading(loading: boolean): void
}

export class HostViewUnsupportedError extends Error {
    constructor() {
        super('Reload the site to enable Host View')
    }
}

export class GameRepresentations<T extends GameState, U extends HydratedGameState<T> & T> {
    private hostGameContext?: GameContext<T, U> = $state.raw()
    private actingPlayerPerspectiveViewEnabled = $state(false)
    private privilegedInspectionEnabled = false
    private representationRequestGeneration = 0
    private disposed = false

    constructor(
        private readonly primary: GameContext<T, U>,
        private readonly dependencies: RepresentationDependencies<T, U>
    ) {}

    get hostContext(): GameContext<T, U> | undefined {
        return this.hostGameContext
    }

    get inspectionRequested(): boolean {
        return this.privilegedInspectionEnabled
    }

    get isViewingAsActingPlayer(): boolean {
        return this.hostGameContext !== undefined && this.actingPlayerPerspectiveViewEnabled
    }

    get actingPlayer(): Player | undefined {
        return this.hostGameContext === undefined
            ? undefined
            : this.privilegedActingPlayer(this.hostGameContext)
    }

    captureValidity(): () => boolean {
        const generation = this.representationRequestGeneration
        return () => !this.isRepresentationRequestStale(generation)
    }

    dispose(): void {
        this.disposed = true
        this.representationRequestGeneration += 1
        this.actingPlayerPerspectiveViewEnabled = false
        this.hostGameContext = undefined
    }

    async setPrivilegedEnabled(privilegedViewRequested: boolean): Promise<void> {
        if (
            privilegedViewRequested &&
            this.usesProjectedHostedRepresentation() &&
            !this.dependencies.supportsHostView()
        ) {
            throw new HostViewUnsupportedError()
        }
        this.privilegedInspectionEnabled = privilegedViewRequested
        if (!this.usesProjectedHostedRepresentation()) {
            return
        }

        await this.runRequest(async (isCurrent) => {
            if (privilegedViewRequested) {
                const hostContext = await this.loadGameContext({ hostView: true })
                if (!isCurrent()) {
                    return
                }
                this.hostGameContext = hostContext
                this.actingPlayerPerspectiveViewEnabled = false
                this.dependencies.publish(hostContext)
                return
            }

            const hostContext = this.hostGameContext
            if (hostContext === undefined) {
                return
            }

            const perspective = this.ordinaryPerspective()
            const safeContext = this.projectGameContext(hostContext, perspective)
            this.actingPlayerPerspectiveViewEnabled = false
            this.hostGameContext = undefined
            this.dependencies.publish(safeContext)

            const ordinaryContext = await this.loadGameContext()
            if (!isCurrent()) {
                return
            }
            this.dependencies.publish(ordinaryContext)
        })
    }

    setViewAsActingPlayer(enabled: boolean): void {
        const hostContext = this.hostGameContext
        if (!enabled) {
            this.actingPlayerPerspectiveViewEnabled = false
            if (hostContext !== undefined) {
                this.dependencies.publish(hostContext)
            }
            return
        }

        assertExists(hostContext, 'Host View is not available')
        const actingPlayer = this.privilegedActingPlayer(hostContext)
        assertExists(actingPlayer, 'Acting Player is not available')
        const projectedContext = this.projectGameContext(hostContext, {
            kind: 'player',
            playerId: actingPlayer.id
        })
        this.actingPlayerPerspectiveViewEnabled = true
        this.dependencies.publish(projectedContext)
    }

    private usesProjectedHostedRepresentation(): boolean {
        return (
            this.primary.game.storage === GameStorage.Remote &&
            !this.primary.game.hotseat &&
            this.primary.runtime.visibility !== undefined
        )
    }

    private async loadGameContext(options?: { hostView: true }): Promise<GameContext<T, U>> {
        const { game, actions } = await this.dependencies.getGame(this.primary.game.id, options)
        const state = game.state
        assertExists(state, `Game ${game.id} has no state`)
        if (!this.isRuntimeState(state)) {
            throw new Error(`Game ${game.id} state does not match its projected schema`)
        }

        const stateFreeGame = structuredClone(game)
        delete stateFreeGame.state
        return new GameContext({
            runtime: this.primary.runtime,
            game: stateFreeGame,
            state,
            actions
        })
    }

    private isRuntimeState(state: GameState): state is T {
        const visibility = this.primary.runtime.visibility
        return visibility !== undefined && Value.Check(visibility.state.schema, state)
    }

    private ordinaryPerspective(): Visibility.Perspective {
        const userId = this.dependencies.getUserId()
        const player = this.primary.game.players.find((candidate) => candidate.userId === userId)
        return player === undefined
            ? { kind: 'spectator' }
            : { kind: 'player', playerId: player.id }
    }

    private privilegedActingPlayer(hostContext: GameContext<T, U>): Player | undefined {
        const activePlayerIds = hostContext.state.activePlayerIds
        const chosenPlayerId = this.dependencies.getChosenPlayerId()
        const chosenPlayer = hostContext.game.players.find(
            (player) => player.id === chosenPlayerId && activePlayerIds.includes(player.id)
        )
        if (chosenPlayerId !== undefined) {
            return chosenPlayer
        }

        const primaryPlayer = hostContext.game.players.find(
            (player) =>
                player.userId === this.dependencies.getUserId() &&
                activePlayerIds.includes(player.id)
        )
        if (primaryPlayer !== undefined) {
            return primaryPlayer
        }

        const activePlayers = hostContext.game.players.filter((player) =>
            activePlayerIds.includes(player.id)
        )
        return activePlayers.length === 1 ? activePlayers[0] : undefined
    }

    private projectGameContext(
        hostContext: GameContext<T, U>,
        perspective: Visibility.Perspective
    ): GameContext<T, U> {
        const visibility = this.primary.runtime.visibility
        assertExists(visibility, 'Game Runtime has no visibility projection')
        const history = Visibility.projectActionHistory({
            currentState: hostContext.state,
            actions: hostContext.actions,
            visibility,
            perspective,
            replay: { game: hostContext.game, runtime: this.primary.runtime }
        })
        const state = history.currentState
        if (!this.isRuntimeState(state)) {
            throw new Error(`Game ${hostContext.game.id} projection has an invalid state`)
        }
        return new GameContext({
            runtime: this.primary.runtime,
            game: structuredClone(hostContext.game),
            state,
            actions: [...history.actions]
        })
    }

    private replaceDisplayedPrivilegedContext(hostContext: GameContext<T, U>): void {
        if (this.actingPlayerPerspectiveViewEnabled) {
            const actingPlayer = this.privilegedActingPlayer(hostContext)
            if (actingPlayer !== undefined) {
                this.dependencies.publish(
                    this.projectGameContext(hostContext, {
                        kind: 'player',
                        playerId: actingPlayer.id
                    })
                )
                return
            }
            this.actingPlayerPerspectiveViewEnabled = false
        }

        this.dependencies.publish(hostContext)
    }

    async refreshHost(): Promise<void> {
        if (this.hostGameContext === undefined) {
            return
        }

        await this.runRequest(async (isCurrent) => {
            const hostContext = await this.loadGameContext({ hostView: true })
            if (!isCurrent()) {
                return
            }
            this.hostGameContext = hostContext
            this.replaceDisplayedPrivilegedContext(hostContext)
        })
    }

    async reload(): Promise<void> {
        if (this.disposed) {
            return
        }

        if (this.privilegedInspectionEnabled) {
            if (this.hostGameContext === undefined) {
                await this.setPrivilegedEnabled(true)
            } else {
                await this.refreshHost()
            }
            return
        }

        if (this.hostGameContext !== undefined) {
            await this.setPrivilegedEnabled(false)
            return
        }

        await this.runRequest(async (isCurrent) => {
            const ordinaryContext = await this.loadGameContext()
            if (!isCurrent()) {
                return
            }
            this.dependencies.publish(ordinaryContext)
        })
    }

    private async runRequest(work: (isCurrent: () => boolean) => Promise<void>): Promise<void> {
        this.representationRequestGeneration += 1
        const isCurrent = this.captureValidity()
        this.dependencies.setLoading(true)
        try {
            await work(isCurrent)
        } finally {
            if (isCurrent()) {
                this.dependencies.setLoading(false)
            }
        }
    }

    private isRepresentationRequestStale(requestGeneration: number): boolean {
        return this.disposed || requestGeneration !== this.representationRequestGeneration
    }
}
