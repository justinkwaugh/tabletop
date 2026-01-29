/* eslint-disable svelte/prefer-svelte-reactivity */
import type { Game, GameState, HydratedGameState, Player } from '@tabletop/common'
import type { GameSession } from '$lib/model/gameSession.svelte.js'
import { RuneBackedStore } from '$lib/utils/runeBackedStore.svelte.js'

export type GameSessionBridgeColors = {
    getPlayerBgColor: (playerId?: string) => string
    getPlayerTextColor: (playerId?: string) => string
}

export class GameSessionBridge<T extends GameState, U extends HydratedGameState<T> & T> {
    readonly isExploring: RuneBackedStore<boolean>
    readonly gameHotseat: RuneBackedStore<boolean>
    readonly activePlayers: RuneBackedStore<Player[]>
    readonly adminPlayerId: RuneBackedStore<string | undefined>
    readonly myPlayer: RuneBackedStore<Player | undefined>
    readonly explorationsForGame: RuneBackedStore<Game[]>
    readonly currentExplorationGame: RuneBackedStore<Game | undefined>
    readonly hasUnsavedChanges: RuneBackedStore<boolean>
    readonly isViewingHistory: RuneBackedStore<boolean>
    readonly gameState: RuneBackedStore<U | undefined>
    readonly colors: RuneBackedStore<GameSessionBridgeColors>

    constructor(private session: GameSession<T, U>) {
        this.isExploring = new RuneBackedStore(() => this.session.isExploring)
        this.gameHotseat = new RuneBackedStore(() => this.session.game.hotseat)
        this.activePlayers = new RuneBackedStore(() => this.session.activePlayers)
        this.adminPlayerId = new RuneBackedStore(() => this.session.adminPlayerId)
        this.myPlayer = new RuneBackedStore(() => this.session.myPlayer)
        this.explorationsForGame = new RuneBackedStore(() => this.session.explorationsForGame)
        this.currentExplorationGame = new RuneBackedStore(
            () => this.session.explorations.getCurrentExploration()?.game
        )
        this.hasUnsavedChanges = new RuneBackedStore(
            () => this.session.explorations.hasUnsavedChanges()
        )
        this.isViewingHistory = new RuneBackedStore(() => this.session.isViewingHistory)
        this.gameState = new RuneBackedStore(() => this.session.gameState)
        this.colors = new RuneBackedStore(() => this.buildColorsSnapshot())
    }

    connect() {
        this.isExploring.connect()
        this.gameHotseat.connect()
        this.activePlayers.connect()
        this.adminPlayerId.connect()
        this.myPlayer.connect()
        this.explorationsForGame.connect()
        this.currentExplorationGame.connect()
        this.hasUnsavedChanges.connect()
        this.isViewingHistory.connect()
        this.gameState.connect()
        this.colors.connect()
    }

    setChosenAdminPlayerId(value: string | undefined) {
        this.session.chosenAdminPlayerId = value
    }

    private buildColorsSnapshot(): GameSessionBridgeColors {
        const bgById = new Map<string, string>()
        const textById = new Map<string, string>()
        for (const player of this.session.game.players) {
            bgById.set(player.id, this.session.colors.getPlayerBgColor(player.id))
            textById.set(player.id, this.session.colors.getPlayerTextColor(player.id))
        }

        const defaultBg = this.session.colors.getPlayerBgColor(undefined)
        const defaultText = this.session.colors.getPlayerTextColor(undefined)

        return {
            getPlayerBgColor: (playerId?: string) =>
                bgById.get(playerId ?? 'unknown') ?? defaultBg,
            getPlayerTextColor: (playerId?: string) =>
                textById.get(playerId ?? 'unknown') ?? defaultText
        }
    }
}
